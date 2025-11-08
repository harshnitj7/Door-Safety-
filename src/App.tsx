import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';

export default function App() {
  const [status, setStatus] = useState('No object detected');
  const [imageUri, setImageUri] = useState(null);
  const [history, setHistory] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    // Use secure WebSocket for Render
    const WS_URL = 'wss://tsc-project.onrender.com';
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setStatus('Connected to server');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.message === 'New image' && data.url) {
          const timestamp = new Date();
          const formattedTime = timestamp.toLocaleString(); // readable date/time

          setImageUri(data.url);
          setStatus('Object detected — image received');

          // Add to history (newest first)
          setHistory(prev => [
            { url: data.url, time: formattedTime },
            ...prev,
          ]);
        } else {
          console.log('ℹ️ WS message:', data);
        }
      } catch (err) {
        console.log('⚠️ Invalid WS payload:', e.data);
      }
    };

    ws.onerror = (err) => {
      console.log('❌ WebSocket error:', err.message);
      setStatus('WebSocket error');
    };

    ws.onclose = () => {
      console.log('🔒 WebSocket closed');
      setStatus('Disconnected');
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Door Safety System</Text>
      <Text>{status}</Text>

      {/* Latest Image */}
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text>No image yet</Text>
        )}
      </View>

      {/* History Section */}
      <Text style={styles.historyTitle}>Detection History</Text>
      <ScrollView style={styles.scrollView}>
        {history.length > 0 ? (
          history.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Image source={{ uri: item.url }} style={styles.historyImage} />
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 10 }}>No history yet</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  imageBox: {
    width: '100%',
    height: 250,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 8,
  },
  image: { width: '100%', height: '100%', borderRadius: 8 },
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
  historyImage: { width: '100%', height: 150 },
  timeText: { padding: 6, textAlign: 'center', color: '#333', fontSize: 14 },
});
