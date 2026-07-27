import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { extractYouTubeId } from '@/features/screening-rooms/api';

export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (ms: number) => void;
  getPosition: () => void; // async — result comes via onPosition callback
}

interface Props {
  videoUrl: string;
  videoType: 'youtube' | 'direct';
  isHost: boolean;
  onReady?: () => void;
  onStateChange?: (isPlaying: boolean, positionMs: number) => void;
  onPosition?: (positionMs: number) => void;
}

function buildYouTubeHtml(videoId: string, showControls: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    #player { width:100%; height:100%; }
    iframe { width:100%; height:100%; border:none; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player;
    var ready = false;
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${videoId}',
        playerVars: {
          autoplay: 0,
          controls: ${showControls ? 1 : 0},
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          fs: 0
        },
        events: {
          onReady: function() {
            ready = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          },
          onStateChange: function(e) {
            var isPlaying = e.data === YT.PlayerState.PLAYING;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'stateChange',
              isPlaying: isPlaying,
              positionMs: Math.round((player.getCurrentTime() || 0) * 1000)
            }));
          }
        }
      });
    }
    document.addEventListener('message', handleMsg);
    window.addEventListener('message', handleMsg);
    function handleMsg(e) {
      if (!player || !ready) return;
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'play') player.playVideo();
        else if (msg.type === 'pause') player.pauseVideo();
        else if (msg.type === 'seek') player.seekTo(msg.ms / 1000, true);
        else if (msg.type === 'getPosition') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'position',
            positionMs: Math.round((player.getCurrentTime() || 0) * 1000)
          }));
        }
      } catch(err) {}
    }
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;
}

function buildDirectVideoHtml(videoUrl: string, showControls: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    video { width:100%; height:100%; object-fit:contain; display:block; }
  </style>
</head>
<body>
  <video id="v"
    src="${videoUrl}"
    playsinline
    webkit-playsinline
    ${showControls ? 'controls' : ''}
    preload="metadata">
  </video>
  <script>
    var v = document.getElementById('v');
    v.addEventListener('canplay', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });
    v.addEventListener('play', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', isPlaying: true, positionMs: Math.round(v.currentTime * 1000) }));
    });
    v.addEventListener('pause', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', isPlaying: false, positionMs: Math.round(v.currentTime * 1000) }));
    });
    document.addEventListener('message', handleMsg);
    window.addEventListener('message', handleMsg);
    function handleMsg(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'play') v.play();
        else if (msg.type === 'pause') v.pause();
        else if (msg.type === 'seek') v.currentTime = msg.ms / 1000;
        else if (msg.type === 'getPosition') {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'position', positionMs: Math.round(v.currentTime * 1000) }));
        }
      } catch(err) {}
    }
  </script>
</body>
</html>`;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { videoUrl, videoType, isHost, onReady, onStateChange, onPosition },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    play: () => webViewRef.current?.injectJavaScript(`
      try { document.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'play' }) })); } catch(e){}; true;
    `),
    pause: () => webViewRef.current?.injectJavaScript(`
      try { document.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'pause' }) })); } catch(e){}; true;
    `),
    seekTo: (ms: number) => webViewRef.current?.injectJavaScript(`
      try { document.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'seek', ms: ${ms} }) })); } catch(e){}; true;
    `),
    getPosition: () => webViewRef.current?.injectJavaScript(`
      try { document.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'getPosition' }) })); } catch(e){}; true;
    `),
  }));

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') onReady?.();
      else if (msg.type === 'stateChange') onStateChange?.(msg.isPlaying, msg.positionMs);
      else if (msg.type === 'position') onPosition?.(msg.positionMs);
    } catch {}
  }

  const youtubeId = videoType === 'youtube' ? extractYouTubeId(videoUrl) : null;
  const html = videoType === 'youtube' && youtubeId
    ? buildYouTubeHtml(youtubeId, isHost)
    : buildDirectVideoHtml(videoUrl, isHost);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsFullscreenVideo={false}
        originWhitelist={['*']}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});
