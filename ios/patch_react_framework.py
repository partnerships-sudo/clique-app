#!/usr/bin/env python3
"""
Patch React.framework (arm64) to NOP out the BLR x8 call to
HermesRuntime::debugJavaScript in initializeRuntime::$_0.

Root cause: The prebuilt React.framework (Expo SDK 54 / RN 0.81.5) calls
debugJavaScript with a null sourceURL reference during Debug initialization,
causing a KERN_INVALID_ADDRESS crash (SIGSEGV at 0x17 = SSO length byte).
This does not affect Release builds. The NOP is safe; debugJavaScript returns void.

Usage: Called by Xcode Run Script Build Phase after framework copy.
"""
import struct, sys, os

BLR_X8 = bytes([0x00, 0x01, 0x3F, 0xD6])  # BLR x8
NOP     = bytes([0x1F, 0x20, 0x03, 0xD5])  # NOP

FAT_MAGIC    = 0xCAFEBABE
CPU_ARM64    = 0x0100000C
IMAGE_OFFSET = 0x285690  # BLR instruction's offset within the arm64 image

def find_arm64_slice_offset(data: bytes):
    magic = struct.unpack_from(">I", data, 0)[0]
    if magic != FAT_MAGIC:
        return None
    nfat = struct.unpack_from(">I", data, 4)[0]
    for i in range(nfat):
        base = 8 + i * 20
        cputype = struct.unpack_from(">I", data, base)[0]
        offset  = struct.unpack_from(">I", data, base + 8)[0]
        if cputype == CPU_ARM64:
            return offset
    return None

def patch(path: str) -> str:
    with open(path, "rb") as f:
        data = bytearray(f.read())

    arm64_off = find_arm64_slice_offset(data)
    if arm64_off is None:
        # Single-arch arm64 Mach-O — try offset 0
        if struct.unpack_from("<I", data, 0)[0] == 0xFEEDFACF:
            arm64_off = 0
        else:
            return f"SKIP: not a recognized arm64 binary"

    patch_off = arm64_off + IMAGE_OFFSET
    if patch_off + 4 > len(data):
        return f"SKIP: file too small ({len(data)}) for offset {patch_off}"

    B_NEXT = bytes([0x01, 0x00, 0x00, 0x14])  # B #4 (branch to next instr = safe no-op)

    current = bytes(data[patch_off:patch_off+4])
    if current == NOP:
        return "already patched (NOP)"
    if current == B_NEXT:
        return "already safe (B #4)"
    if current != BLR_X8:
        return f"SKIP: unexpected bytes {current.hex()} at offset {patch_off:#x}"

    data[patch_off:patch_off+4] = NOP
    with open(path, "wb") as f:
        f.write(data)
    return f"patched at file offset {patch_off:#x}"

if __name__ == "__main__":
    paths = sys.argv[1:] if len(sys.argv) > 1 else []
    if not paths:
        # Default: patch all React.framework copies we can find in DerivedData
        import glob
        derived = os.path.expanduser("~/Library/Developer/Xcode/DerivedData")
        patterns = [
            f"{derived}/**/React.framework/React",
        ]
        for pat in patterns:
            paths.extend(glob.glob(pat, recursive=True))
        # Also patch the Pods source
        pods_react = os.path.join(
            os.path.dirname(__file__),
            "Pods/React-Core-prebuilt/React.xcframework"
            "/ios-arm64_x86_64-simulator/React.framework/React"
        )
        if os.path.exists(pods_react):
            paths.append(pods_react)

    for p in paths:
        result = patch(p)
        print(f"[react-patch] {result}: {p}")
