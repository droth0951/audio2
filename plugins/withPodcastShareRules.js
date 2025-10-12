const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plist = require('@expo/plist');

/**
 * Custom Expo Config Plugin to inject comprehensive NSExtensionActivationRule
 * into the ShareExtension's Info.plist to ensure visibility in Apple Podcasts.
 *
 * Apple Podcasts requires:
 * - High MaxCount values (999) for all media types
 * - MinCount values (1) for text and attachments
 * - NSExtensionActivationDictionaryVersion: 2 for permissive matching
 *
 * This plugin bypasses the limitations of expo-share-intent which doesn't
 * support MinCount rules.
 *
 * IMPORTANT: On EAS builds, this will work correctly. For local prebuild testing,
 * the ShareExtension-Info.plist can be manually verified/modified after prebuild completes.
 */
const withPodcastShareRules = (config) => {
  // Use dangerousMod as a hook that runs during native generation
  // The actual modification happens in a setTimeout to allow expo-share-intent to create files first
  return withDangerousMod(config, [
    'ios',
    async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const platformProjectRoot = config.modRequest.platformProjectRoot;

    // Path to ShareExtension's Info.plist
    // expo-share-intent names it ShareExtension-Info.plist
    const shareExtensionInfoPlistPath = path.join(
      platformProjectRoot,
      'ShareExtension',
      'ShareExtension-Info.plist'
    );

    console.log('🔍 Looking for ShareExtension Info.plist at:', shareExtensionInfoPlistPath);

    // Check if ShareExtension Info.plist exists
    if (!fs.existsSync(shareExtensionInfoPlistPath)) {
      console.warn('⚠️  ShareExtension Info.plist not found. Skipping plugin.');
      return config;
    }

    console.log('📝 Reading ShareExtension Info.plist...');

    // Read and parse the Info.plist
    const infoPlistContent = fs.readFileSync(shareExtensionInfoPlistPath, 'utf8');
    const infoPlist = plist.parse(infoPlistContent);

    // Comprehensive NSExtensionActivationRule dictionary for Apple Podcasts compatibility
    const comprehensiveActivationRules = {
        // Version 2 enables more permissive "at least one type" matching
        NSExtensionActivationDictionaryVersion: 2,

        // High MaxCount values (999) required for Apple Podcasts visibility
        NSExtensionActivationSupportsFileWithMaxCount: 999,
        NSExtensionActivationSupportsAttachmentsWithMaxCount: 999,
        NSExtensionActivationSupportsImageWithMaxCount: 999,
        NSExtensionActivationSupportsMovieWithMaxCount: 999,  // Critical for Podcasts
        NSExtensionActivationSupportsWebURLWithMaxCount: 999,
        NSExtensionActivationSupportsWebPageWithMaxCount: 999,

        // Text support
        NSExtensionActivationSupportsText: true,

        // MinCount rules - required for matching Apple Podcasts' composite payload
        NSExtensionActivationSupportsTextWithMinCount: 1,
        NSExtensionActivationSupportsAttachmentsWithMinCount: 1,
      };

    // Navigate to NSExtension > NSExtensionAttributes > NSExtensionActivationRule
    if (!infoPlist.NSExtension) {
      infoPlist.NSExtension = {};
    }
    if (!infoPlist.NSExtension.NSExtensionAttributes) {
      infoPlist.NSExtension.NSExtensionAttributes = {};
    }

    // Inject the comprehensive activation rules
    infoPlist.NSExtension.NSExtensionAttributes.NSExtensionActivationRule =
      comprehensiveActivationRules;

    console.log('✅ Injected comprehensive NSExtensionActivationRule into ShareExtension Info.plist');
    console.log('📋 Activation Rules:', JSON.stringify(comprehensiveActivationRules, null, 2));

    // Write back to Info.plist
    const updatedPlistContent = plist.build(infoPlist);
    fs.writeFileSync(shareExtensionInfoPlistPath, updatedPlistContent, 'utf8');

    console.log('💾 ShareExtension Info.plist updated successfully');

      return config;
    },
  ]);
};

module.exports = withPodcastShareRules;
