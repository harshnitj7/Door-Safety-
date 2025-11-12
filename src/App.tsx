import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [imageUri, setImageUri] = useState(null);
  const [imageHeight, setImageHeight] = useState(250); // dynamic height
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef(null);

  const STORAGE_KEY = '@door_safety_history';
  const screenWidth = Dimensions.get('window').width - 40; // container padding (20 each side)

  // 🔹 Utility: Get scaled height for a given image URL
  const getDynamicHeight = (uri:any) => {
    return new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => {
          const ratio = height / width;
          resolve(screenWidth * ratio);
        },
        (error) => {
          console.log('⚠️ Error getting image size:', error);
          resolve(250); // fallback height
        }
      );
    });
  };

  // 🔹 Set latest image + height
  const updateMainImage = async (uri:any) => {
    const h:any = await getDynamicHeight(uri);
    setImageUri(uri);
    setImageHeight(h);
  };

  // 🔹 Load history from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setHistory(parsed);
          if (parsed.length > 0) updateMainImage(parsed[0].url);
        }
      } catch (err) {
        console.log('⚠️ Error loading history:', err);
      }
    })();
  }, []);

  // 🔹 Save updated history
  const saveHistory = async (newHistory:any) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (err) {
      console.log('⚠️ Error saving history:', err);
    }
  };

  // 🔹 WebSocket setup
  useEffect(() => {
    const WS_URL = 'wss://tsc-project.onrender.com';
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setStatus('Connected to server');

    ws.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message === 'New image' && data.url) {
          const timestamp = new Date().toLocaleString();
          await updateMainImage(data.url);
          const newEntry = { url: data.url, time: timestamp };
          const updatedHistory:any = [newEntry, ...history];
          setHistory(updatedHistory);
          saveHistory(updatedHistory);
          setStatus('Object detected — image received');
        }
      } catch (err) {
        console.log('⚠️ Invalid WS payload:', e.data);
      }
    };

    ws.onerror = () => setStatus('WebSocket error');
    ws.onclose = () => setStatus('Disconnected');
    wsRef.current = ws;
    return () => ws.close();
  }, [history]);

  // 🔹 Pull-to-refresh: reload + request new image
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'refresh_request' }));
        setStatus('Requested latest image from server...');
      } else {
        setStatus('WebSocket not connected — cannot refresh');
      }
    } catch (err) {
      console.log('⚠️ Error refreshing history:', err);
    }
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Door Safety System</Text>
      <Text>{status}</Text>

      {/* ✅ Fixed width, dynamic height for latest image */}
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, { width: '100%', height: imageHeight }]}
            resizeMode="contain"
          />
        ) : (
          <Text>No image yet</Text>
        )}
      </View>

      {/* ✅ Detection History */}
      <Text style={styles.historyTitle}>Detection History</Text>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {history.length > 0 ? (
          history.map((item, index) => (
            <HistoryImage key={index} item={item} screenWidth={screenWidth} />
          ))
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 10 }}>No history yet</Text>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * 📷 Reusable component for history image
 * (calculates its own height dynamically)
 */
function HistoryImage({ item, screenWidth }:any) {
  const [height, setHeight] = useState(150);

  useEffect(() => {
    Image.getSize(
      item.url,
      (width, imgHeight) => {
        const ratio = imgHeight / width;
        setHeight(screenWidth * ratio);
      },
      () => setHeight(250)
    );
  }, [item.url]);

  return (
    <View style={styles.historyItem}>
      <Image source={{ uri: item.url }} style={{ width: '100%', height }} resizeMode="contain" />
      <Text style={styles.timeText}>{item.time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  imageBox: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  image: { borderRadius: 8 },
  historyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 8 },
  scrollView: { flex: 1 },
  historyItem: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  timeText: { padding: 6, textAlign: 'center', color: '#333', fontSize: 14 },
});
