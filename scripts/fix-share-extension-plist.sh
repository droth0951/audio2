#!/bin/bash

# Script to inject comprehensive NSExtensionActivationRule into ShareExtension Info.plist
# This ensures Audio2 appears in Apple Podcasts share sheet
#
# Apple Podcasts requires:
# - NSExtensionActivationDictionaryVersion: 2
# - High MaxCount values (999) for all media types
# - MinCount values (1) for text and attachments

set -e

PLIST_PATH="ios/ShareExtension/ShareExtension-Info.plist"

echo "🔍 Looking for ShareExtension Info.plist at: $PLIST_PATH"

if [ ! -f "$PLIST_PATH" ]; then
    echo "⚠️  ShareExtension Info.plist not found at $PLIST_PATH"
    echo "   This script should run after 'npx expo prebuild' completes"
    exit 1
fi

echo "📝 Injecting comprehensive NSExtensionActivationRule..."

# Use PlistBuddy to modify the plist
# First, delete the existing NSExtensionActivationRule to start fresh
/usr/libexec/PlistBuddy -c "Delete :NSExtension:NSExtensionAttributes:NSExtensionActivationRule" "$PLIST_PATH" 2>/dev/null || true

# Create a new dictionary
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule dict" "$PLIST_PATH"

# Add NSExtensionActivationDictionaryVersion: 2
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationDictionaryVersion integer 2" "$PLIST_PATH"

# Add high MaxCount values (999) - required for Apple Podcasts visibility
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsFileWithMaxCount integer 999" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsAttachmentsWithMaxCount integer 999" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsImageWithMaxCount integer 999" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsMovieWithMaxCount integer 999" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsWebURLWithMaxCount integer 999" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsWebPageWithMaxCount integer 999" "$PLIST_PATH"

# Add text support
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsText bool true" "$PLIST_PATH"

# Add MinCount rules - critical for Apple Podcasts compatibility
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsTextWithMinCount integer 1" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :NSExtension:NSExtensionAttributes:NSExtensionActivationRule:NSExtensionActivationSupportsAttachmentsWithMinCount integer 1" "$PLIST_PATH"

echo "✅ Successfully injected comprehensive NSExtensionActivationRule"
echo "📋 Verifying configuration..."

# Verify the changes
/usr/libexec/PlistBuddy -c "Print :NSExtension:NSExtensionAttributes:NSExtensionActivationRule" "$PLIST_PATH"

echo "💾 ShareExtension Info.plist updated successfully"
