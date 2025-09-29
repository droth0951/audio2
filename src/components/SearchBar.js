import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';

const SearchBar = ({
  onSearch,
  placeholder = "Search podcasts or paste RSS feed URL",
  initialValue = "",
  style,
  containerStyle,
  debounceDelay = 500 // Add debounce delay prop for real-time search
}) => {
  const [searchText, setSearchText] = useState(initialValue);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search for very short queries (less than 2 characters)
    const query = searchText.trim();
    const isUrl = /^https?:\/\//i.test(query);

    // Only auto-search for non-URL queries
    // URLs should only be submitted explicitly via Enter key
    if (query && query.length >= 2 && !isUrl) {
      // Set new timer for search
      debounceTimerRef.current = setTimeout(() => {
        if (onSearch) {
          onSearch(query);
        }
      }, debounceDelay);
    }

    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchText, onSearch, debounceDelay]);

  // Memoized handlers to prevent re-renders
  const handleTextChange = useCallback((text) => {
    setSearchText(text);
  }, []);

  const handleSubmit = useCallback(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const query = searchText.trim();
    if (query && onSearch) {
      onSearch(query);
      // Keep focus to maintain keyboard
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [searchText, onSearch]);

  const handleFocus = useCallback(() => {
    // Focus handling if needed
  }, []);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={handleTextChange}
          onSubmitEditing={handleSubmit}
          onFocus={handleFocus}
          blurOnSubmit={false}
          returnKeyType="search"
          keyboardAppearance="dark"
          autoCorrect={false}
          autoCapitalize="sentences"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 30,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    backgroundColor: '#2d2d2d',
    color: '#f4f4f4',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#404040',
  },
});

export default SearchBar;
