import React, { useState, useCallback, useRef } from 'react';
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
}) => {
  const [searchText, setSearchText] = useState(initialValue);
  const inputRef = useRef(null);

  // Memoized handlers to prevent re-renders
  const handleTextChange = useCallback((text) => {
    setSearchText(text);
  }, []);

  const handleSubmit = useCallback(() => {
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
