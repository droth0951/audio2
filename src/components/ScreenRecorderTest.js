// Create: src/components/ScreenRecorderTest.js

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import * as ScreenRecorder from 'expo-screen-recorder';
import * as MediaLibrary from 'expo-media-library';

export default function ScreenRecorderTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);

  const startRecording = async () => {
    try {
      console.log('Starting screen recording...');
      setIsRecording(true);
      
      // Start recording (false = no microphone)
      await ScreenRecorder.startRecording(false);
      
      Alert.alert('Recording Started', 'Screen recording is now active');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', `Failed to start recording: ${error.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stopping screen recording...');
      
      // Stop recording and get file URL
      const outputUrl = await ScreenRecorder.stopRecording();
      
      console.log('Recording saved to:', outputUrl);
      setIsRecording(false);
      setRecordingUrl(outputUrl);
      
      // Save to Photos app
      if (outputUrl) {
        const asset = await MediaLibrary.createAssetAsync(outputUrl);
        console.log('Saved to Photos:', asset);
        Alert.alert('Success', 'Recording saved to Photos app!');
      }
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', `Failed to stop recording: ${error.message}`);
      setIsRecording(false);
    }
  };

  const testFullWorkflow = async () => {
    try {
      Alert.alert(
        'Test Workflow', 
        'This will record for 10 seconds then auto-stop',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Test', onPress: runTest }
        ]
      );
    } catch (error) {
      console.error('Test workflow error:', error);
    }
  };

  const runTest = async () => {
    try {
      // Start recording
      await startRecording();
      
      // Record for 10 seconds
      setTimeout(async () => {
        await stopRecording();
      }, 10000);
      
    } catch (error) {
      console.error('Test run error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Screen Recorder Test</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Status: {isRecording ? 'Recording...' : 'Ready'}
          </Text>
          {recordingUrl && (
            <Text style={styles.urlText}>
              Last recording: {recordingUrl.substring(0, 50)}...
            </Text>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[
              styles.button, 
              isRecording ? styles.stopButton : styles.startButton
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.testButton]}
            onPress={testFullWorkflow}
            disabled={isRecording}
          >
            <Text style={styles.buttonText}>
              Test 10s Recording
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>What This Tests:</Text>
          <Text style={styles.infoText}>• Screen recording permissions</Text>
          <Text style={styles.infoText}>• Basic start/stop functionality</Text>
          <Text style={styles.infoText}>• File output and Photos saving</Text>
          <Text style={styles.infoText}>• Integration with expo-media-library</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f4f4',
    textAlign: 'center',
    marginBottom: 30,
  },
  statusContainer: {
    backgroundColor: '#2d2d2d',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  statusText: {
    fontSize: 18,
    color: '#f4f4f4',
    textAlign: 'center',
    marginBottom: 10,
  },
  urlText: {
    fontSize: 12,
    color: '#b4b4b4',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#d97706',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  testButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f4f4f4',
  },
  infoContainer: {
    backgroundColor: '#2d2d2d',
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d97706',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#b4b4b4',
    marginBottom: 5,
  },
});