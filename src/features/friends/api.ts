// Compatibility shim: the mutual "Friends" relationship (approval-required)
// has been replaced by one-way Follow (see @/features/follows/api). The
// handful of call sites that only ever used `useFriends()` as a "who do I
// trust enough to message/add to a group" check keep working unchanged by
// aliasing it to mutual follows — the closest equivalent to the old model.
export { useMutualFollows as useFriends, useSearchUsers } from '@/features/follows/api';
export type { Profile } from '@/features/follows/api';
