import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

// Simple waveform component for AboutModal
const HomeAnimatedWaveform = ({ size = 'large', color = '#d97706', style }) => {
  const bars = [20, 35, 28, 48, 30, 40, 28, 35, 20];
  
  return (
    <View style={[{ height: 60, width: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }, style]}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={{
            width: 5,
            height: height * 0.8,
            backgroundColor: color,
            marginHorizontal: 2,
            borderRadius: 2,
            opacity: 0.8,
          }}
        />
      ))}
    </View>
  );
};

const AboutModal = ({ visible, onClose }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  const openURL = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient colors={['#1c1c1c', '#2d2d2d']} style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#d97706" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About Audio2</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <HomeAnimatedWaveform 
              size="large" 
              style={{ width: 180, height: 70, marginBottom: 20 }} 
            />
            <Text style={styles.appName}>Audio2</Text>
            <Text style={styles.tagline}>Turn audio insights into social conversations</Text>
                            <Text style={styles.version}>Version 1.4.0</Text>
          </View>

          {/* Main Description */}
          <View style={styles.section}>
            <Text style={styles.description}>
              Audio2 transforms podcast moments into shareable video content for LinkedIn, Instagram, and TikTok. 
              Create professional clips with synchronized audio, AI-powered captions, animated waveforms, and podcast artwork in seconds.
            </Text>
          </View>

          {/* Key Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="podcast" size={20} color="#d97706" />
                <Text style={styles.featureText}>Browse any podcast via RSS or Apple Podcasts URL</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="content-cut" size={20} color="#d97706" />
                <Text style={styles.featureText}>Precise clip selection up to 4 minutes</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="closed-caption" size={20} color="#d97706" />
                <Text style={styles.featureText}>AI-powered captions with AssemblyAI integration</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="video-plus" size={20} color="#d97706" />
                <Text style={styles.featureText}>Professional video generation with iOS ReplayKit</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="aspect-ratio" size={20} color="#d97706" />
                <Text style={styles.featureText}>Multiple formats: 9:16 vertical, 1:1 square</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="download" size={20} color="#d97706" />
                <Text style={styles.featureText}>Direct export to Photos app</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="share-variant" size={20} color="#d97706" />
                <Text style={styles.featureText}>Optimized for social media sharing</Text>
              </View>
            </View>
          </View>

          {/* How It Works - Expandable */}
          <TouchableOpacity 
            style={styles.expandableSection}
            onPress={() => toggleSection('howItWorks')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>How It Works</Text>
              <MaterialCommunityIcons 
                name={expandedSection === 'howItWorks' ? 'chevron-up' : 'chevron-down'} 
                size={24} 
                color="#d97706" 
              />
            </View>
            {expandedSection === 'howItWorks' && (
              <View style={styles.expandedContent}>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>Add podcast RSS feeds or Apple Podcasts URLs</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>Browse episodes and find compelling moments</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>Set precise start and end points with timeline</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>4</Text>
                  </View>
                  <Text style={styles.stepText}>Generate AI-powered captions automatically</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>5</Text>
                  </View>
                  <Text style={styles.stepText}>Choose format and generate professional video</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>6</Text>
                  </View>
                  <Text style={styles.stepText}>Export to Photos and share on social platforms</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Technical Specs - Expandable */}
          <TouchableOpacity 
            style={styles.expandableSection}
            onPress={() => toggleSection('technical')}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Technical Details</Text>
              <MaterialCommunityIcons 
                name={expandedSection === 'technical' ? 'chevron-up' : 'chevron-down'} 
                size={24} 
                color="#d97706" 
              />
            </View>
            {expandedSection === 'technical' && (
              <View style={styles.expandedContent}>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Built with</Text>
                  <Text style={styles.techValue}>React Native + Expo SDK</Text>
                </View>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Video Generation</Text>
                  <Text style={styles.techValue}>iOS ReplayKit screen recording</Text>
                </View>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Audio Processing</Text>
                  <Text style={styles.techValue}>expo-av with anti-ducking</Text>
                </View>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Caption Generation</Text>
                  <Text style={styles.techValue}>AssemblyAI with Railway proxy</Text>
                </View>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Output Format</Text>
                  <Text style={styles.techValue}>MP4 with synchronized audio</Text>
                </View>
                <View style={styles.techDetail}>
                  <Text style={styles.techLabel}>Compatibility</Text>
                  <Text style={styles.techValue}>iOS 12.0+ • iPhone only</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>



          {/* Developer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.developerCard}>
              <Text style={styles.developerName}>Developed by Dan Roth</Text>
              <Text style={styles.developerDescription}>
                Audio2 was created to solve the challenge of easily transforming compelling podcast 
                moments into shareable social media content. Every feature prioritizes speed and 
                professional output quality.
              </Text>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => openURL('https://www.linkedin.com/posts/danielroth1_today-im-celebrating-something-that-would-activity-7361403089305710593-aX1k')}
              >
                <MaterialCommunityIcons name="linkedin" size={18} color="#d97706" />
                <Text style={styles.linkText}>Read the development story</Text>
                <MaterialCommunityIcons name="open-in-new" size={14} color="#b4b4b4" />
              </TouchableOpacity>
            </View>
          </View>

          {/* What Makes Audio2 Different */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Makes Audio2 Different</Text>
            <View style={styles.differentiatorList}>
              <View style={styles.differentiatorItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d97706" />
                <Text style={styles.differentiatorText}>
                  <Text style={styles.boldText}>Speed-First Design:</Text> Create videos in under 60 seconds
                </Text>
              </View>
              <View style={styles.differentiatorItem}>
                <MaterialCommunityIcons name="professional-hexagon" size={18} color="#d97706" />
                <Text style={styles.differentiatorText}>
                  <Text style={styles.boldText}>Professional Output:</Text> LinkedIn-ready quality every time
                </Text>
              </View>
              <View style={styles.differentiatorItem}>
                <MaterialCommunityIcons name="gesture-tap" size={18} color="#d97706" />
                <Text style={styles.differentiatorText}>
                  <Text style={styles.boldText}>Intuitive Controls:</Text> Precise timeline scrubbing and clip selection
                </Text>
              </View>
              <View style={styles.differentiatorItem}>
                <MaterialCommunityIcons name="closed-caption" size={18} color="#d97706" />
                <Text style={styles.differentiatorText}>
                  <Text style={styles.boldText}>AI Captions:</Text> Professional captions generated automatically with AssemblyAI
                </Text>
              </View>
              <View style={styles.differentiatorItem}>
                <MaterialCommunityIcons name="waveform" size={18} color="#d97706" />
                <Text style={styles.differentiatorText}>
                  <Text style={styles.boldText}>Live Visualization:</Text> Real-time animated waveform during playback
                </Text>
              </View>
            </View>
          </View>

          {/* Support */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.supportDescription}>
              Audio2 is actively developed and improved based on user feedback. 
              Found a bug or have a feature request?
            </Text>
            
            <View style={styles.supportButtons}>
              <TouchableOpacity 
                style={styles.supportButton}
                onPress={() => openURL('https://apps.apple.com/app/id6748290085?action=write-review')}
              >
                <MaterialCommunityIcons name="star-outline" size={18} color="#d97706" />
                <Text style={styles.supportButtonText}>Rate on App Store</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.supportButton}
                onPress={() => openURL('https://www.linkedin.com/pulse/how-i-built-audio2-non-developers-journey-from-idea-app-daniel-roth-chkvf/')}
              >
                <MaterialCommunityIcons name="comment-outline" size={18} color="#d97706" />
                <Text style={styles.supportButtonText}>Leave Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Built with ❤️ for podcast fans</Text>
            <Text style={styles.copyright}>© 2025 Audio2</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f4',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 30,
  },
  appName: {
    fontSize: 38,
    fontWeight: '300',
    color: '#f4f4f4',
    marginBottom: 10,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: '#d97706',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 30,
  },
  version: {
    fontSize: 14,
    color: '#b4b4b4',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f4f4f4',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#b4b4b4',
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 15,
    color: '#f4f4f4',
    marginLeft: 14,
    flex: 1,
    lineHeight: 20,
  },
  expandableSection: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#404040',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedContent: {
    marginTop: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 1,
  },
  stepNumberText: {
    color: '#f4f4f4',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#b4b4b4',
    lineHeight: 21,
  },
  techDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  techLabel: {
    fontSize: 14,
    color: '#b4b4b4',
    fontWeight: '500',
    flex: 1,
  },
  techValue: {
    fontSize: 14,
    color: '#f4f4f4',
    textAlign: 'right',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: '22%',
    borderWidth: 1,
    borderColor: '#404040',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#b4b4b4',
    textAlign: 'center',
    lineHeight: 14,
  },
  developerCard: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#404040',
  },
  developerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f4',
    marginBottom: 12,
  },
  developerDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#b4b4b4',
    marginBottom: 20,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 10,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: '#f4f4f4',
    fontWeight: '500',
  },
  differentiatorList: {
    gap: 16,
  },
  differentiatorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  differentiatorText: {
    flex: 1,
    fontSize: 14,
    color: '#b4b4b4',
    marginLeft: 14,
    lineHeight: 20,
  },
  boldText: {
    color: '#f4f4f4',
    fontWeight: '600',
  },
  supportDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#b4b4b4',
    marginBottom: 20,
  },
  supportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  supportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  supportButtonText: {
    fontSize: 14,
    color: '#f4f4f4',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: '#b4b4b4',
    marginBottom: 8,
  },
  copyright: {
    fontSize: 14,
    color: '#666666',
  },
});

export default AboutModal;
