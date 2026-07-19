import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export interface ChatImagePayload {
  __chatImage: 1;
  url: string;
  width: number;
  height: number;
}

export interface ChatGifPayload {
  __chatGif: 1;
  url: string;
  preview: string;
  width: number;
  height: number;
}

export function parseChatImage(content: string): ChatImagePayload | null {
  if (!content.startsWith('{')) return null;
  try {
    const p = JSON.parse(content);
    return p.__chatImage === 1 ? (p as ChatImagePayload) : null;
  } catch { return null; }
}

export function parseChatGif(content: string): ChatGifPayload | null {
  if (!content.startsWith('{')) return null;
  try {
    const p = JSON.parse(content);
    return p.__chatGif === 1 ? (p as ChatGifPayload) : null;
  } catch { return null; }
}

export async function pickAndUploadImage(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
  return JSON.stringify({
    __chatImage: 1,
    url: data.publicUrl,
    width: asset.width,
    height: asset.height,
  } satisfies ChatImagePayload);
}
