using System.Buffers;
using System.Buffers.Text;
using System.Text;
using System.Text.RegularExpressions;

namespace Tempo.Core;

/// <summary>
/// The Metadata class supports setting, appending, and getting metadata entries, as well as
/// converting the metadata into an HTTP header string and creating a Metadata
/// instance from an HTTP header string. This class also handles both string
/// and binary data, encoding and decoding binary data as needed.
/// </summary>
public partial class Metadata
{
    // The internal data structure used to store metadata key-value pairs.
    private readonly Dictionary<string, string[]> _metadata;
    // Indicates if the metadata is frozen. Once frozen, no more changes can be made.
    private bool _isFrozen;

    /// <summary>
    /// Creates a new Metadata instance.
    /// </summary>
    public Metadata()
    {
        _metadata = new Dictionary<string, string[]>();
        _isFrozen = false;
    }
    /// <summary>
    /// The total count of keys in the Metadata instance.
    /// </summary>
    public int Size => _metadata.Count;


    /// <summary>
    /// Freezes the Metadata instance. Once frozen, no more changes can be made.
    /// </summary>
    public void Freeze()
    {
        _isFrozen = true;
    }

    /// <summary>
    /// Sets the metadata from a string.
    /// </summary>
    /// <param name="key">The key the value will be stored under</param>
    /// <param name="value">The value to store</param>
    /// <exception cref="InvalidOperationException">If the metadata is frozen.</exception>
    /// <exception cref="ArgumentException">If the key is not a valid metadata key.</exception>
    public void Set(string key, string value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        key = key.ToLowerInvariant();
        InnerSet(key, value);
    }

    /// <summary>
    /// Sets the metadata from a byte array.
    /// </summary>
    /// <param name="key">The key the value will be stored under</param>
    /// <param name="value">The value to store</param>
    /// <exception cref="ArgumentException">If the key is not a binary key.</exception>
    /// <exception cref="InvalidOperationException">If the metadata is frozen.</exception>
    /// <exception cref="ArgumentException">If the key is not a valid metadata key.</exception>
    public void Set(string key, byte[] value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        if (!IsBinaryKey(key)) throw new ArgumentException("Key is not a binary key");
        key = key.ToLowerInvariant();
        string encodedString = string.Create(
        Base64.GetMaxEncodedToUtf8Length(value.Length),
        value,
        (span, bytes) => {
            if (Convert.TryToBase64Chars(bytes, span, out int bytesWritten) == false)
            {
                throw new InvalidOperationException("Failed to encode binary value");
            }
        });
        InnerSet(key, encodedString);
    }

    private void InnerSet(string key, string value)
    {
        if (!IsValidMetadataTextValue(value)) throw new ArgumentException("invalid metadata value: not ASCII");
        _metadata[key] = new string[] { value };
    }

    /// <summary>
    /// Appends a value to a metadata entry with the given key.
    /// </summary>
    /// <param name="key">The key to append to.</param>
    /// <param name="value">The value to append.</param>
    /// <exception cref="InvalidOperationException">If the metadata is frozen.</exception>
    /// <exception cref="ArgumentException">If the key is not a valid metadata key.</exception>
    public void Append(string key, string value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        key = key.ToLowerInvariant();
        InnerAppend(key, value);
    }

    /// <summary>
    /// Appends a binary value to a metadata entry with the given key.
    /// </summary>
    /// <param name="key">The key to append to.</param>
    /// <param name="value">The value to append.</param>
    /// <exception cref="ArgumentException">If the key is not a binary key.</exception>
    /// <exception cref="InvalidOperationException">If the metadata is frozen.</exception>
    /// <exception cref="ArgumentException">If the key is not a valid metadata key.</exception>
    public void Append(string key, byte[] value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        if (!IsBinaryKey(key)) throw new ArgumentException("Key is not a binary key");
        key = key.ToLowerInvariant();
        InnerAppend(key, TempoUtils.Base64Encode(value));
    }

    private void InnerAppend(string key, string value)
    {
        if (!IsValidMetadataTextValue(value)) throw new ArgumentException("invalid metadata value: not ASCII");
        if (!_metadata.TryGetValue(key, out string[]? values))
        {
            _metadata[key] = new string[] { value };
        }
        else
        {
            string[] newValues = new string[values.Length + 1];
            Array.Copy(values, newValues, values.Length);
            newValues[values.Length] = value;
            _metadata[key] = newValues;
        }
    }
    /// <summary>
    /// Retrieves the binary values for a metadata entry with the given key.
    /// </summary>
    /// <param name="key">The key to retrieve.</param>
    /// <returns>The binary values for the given key, or null if the key does not exist.</returns>
    public byte[][]? GetBinaryValues(string key)
    {
        key = key.ToLowerInvariant();
        if (!IsBinaryKey(key)) throw new ArgumentException("Key is not a binary key");
        if (!_metadata.TryGetValue(key, out string[]? values)) return null;
        byte[][] result = new byte[values.Length][];
        for (int i = 0; i < values.Length; i++)
        {
            result[i] = TempoUtils.Base64Decode(values[i]);
        }
        return result;
    }

    /// <summary>
    /// Retrieves the text values for a metadata entry with the given key.
    /// </summary>
    /// <param name="key">The key to retrieve.</param> 
    /// <returns>The text values for the given key, or null if the key does not exist.</returns>
    public string[]? GetTextValues(string key)
    {
        key = key.ToLowerInvariant();
        if (IsBinaryKey(key)) throw new ArgumentException("Key is a binary key");
        _metadata.TryGetValue(key, out string[]? values);
        return values;
    }
    /// <summary>
    /// Removes a metadata entry with the given key.
    /// </summary>
    /// <param name="key">The key to remove.</param>
    /// <exception cref="InvalidOperationException">If the metadata is frozen.</exception>
    public void Remove(string key)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        key = key.ToLowerInvariant();
        _metadata.Remove(key);
    }

    public Dictionary<string, string[]>.KeyCollection Keys => _metadata.Keys;

    /// <summary>
    /// Concatenates (joins) another Metadata instance into the current one.
    /// </summary>
    /// <param name="otherMetadata">The other Metadata instance to concatenate.</param>
    /// <remarks>
    /// If a key already exists, the values from the other instance will be appended.
    /// If a key does not exist, the values from the other instance will be set.
    /// </remarks>
    /// <exception cref="InvalidOperationException">Thrown if the current Metadata instance is frozen.</exception>
    public void Concat(Metadata otherMetadata)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        foreach (var key in otherMetadata.Keys)
        {
            var otherValue = IsBinaryKey(key) ?
            otherMetadata.GetBinaryValues(key)?.Select((b) => TempoUtils.Base64Encode(b)).ToArray()
            : otherMetadata.GetTextValues(key);

            if (otherValue is not null)
            {
                if (_metadata.ContainsKey(key))
                {
                    var current = _metadata[key];
                    var result = new string[current.Length + otherValue.Length];
                    Array.Copy(current, result, current.Length);
                    Array.Copy(otherValue, 0, result, current.Length, otherValue.Length);
                    _metadata[key] = result;
                }
                else
                {
                    _metadata[key] = otherValue;
                }
            }
        }
    }

    /// <summary>
    /// Converts the metadata to a single HTTP header string.
    /// The resulting header string can be appended to an HTTP response
    /// as 'custom-metadata: {metadata}'
    /// </summary>
    /// <returns>The metadata as a single HTTP header string.</returns>
    public string ToHttpHeader()
    {
        var headers = new List<string>();
        foreach (var entry in _metadata)
        {
            var escapedKey = Escape(entry.Key);
            var escapedValues = entry.Value.Select(Escape);
            headers.Add($"{escapedKey}:{string.Join(",", escapedValues)}");
        }
        return string.Join("|", headers);
    }


    #region Static Methods


    /// <summary>
    /// Escapes any pipe symbols in the given string by prefixing them with a backslash.
    /// </summary>
    /// <param name="value">The input string.</param>
    /// <returns>The escaped string.</returns>
    private static string Escape(string value) => EscapeRegex().Replace(value, "\\|").Trim();

    /// <summary>
    /// Unescapes any escaped pipe symbols in the given string by removing the backslashes.
    /// </summary>
    /// <param name="value">The input string.</param>
    /// <returns>The unescaped string.</returns>
    private static string Unescape(string value) => UnescapeRegex().Replace(value, "|");

    [GeneratedRegex(@"\|")]
    private static partial Regex EscapeRegex();
    [GeneratedRegex(@"\\\|")]
    private static partial Regex UnescapeRegex();


    /// <summary>
    /// Checks if the given key is valid according to the following rules:
    /// - Keys are automatically converted to lowercase, so "key1" and "kEy1" will be the same key.
    /// - Metadata keys are always strings.
    /// - To store binary data value in metadata, simply add a "-bin" suffix to the key.
    /// </summary>
    /// <param name="key">The metadata key.</param>
    /// <returns>True if the key is valid, false otherwise.</returns>
    private static bool IsValidKey(ReadOnlySpan<char> key)
    {
        if (key.IsEmpty || key.IsWhiteSpace()) return false;
        foreach (byte ch in key)
        {
            bool validLowercaseLetter = ch >= 97 && ch <= 122;
            bool validUppercaseLetter = ch >= 65 && ch <= 90;
            bool validDigit = ch >= 48 && ch <= 57;
            bool validOther = ch == 46 || ch == 45 || ch == 95;
            if (!validLowercaseLetter && !validUppercaseLetter && !validDigit && !validOther)
            {
                return false;
            }
        }
        return true;
    }

    /// <summary>
    /// Validates that a given string is a valid Tempo ASCII-Value.
    /// A valid Tempo ASCII-Value must be printable ASCII (including/plus spaces), ranging from 0x20 to 0x7E inclusive.
    /// </summary>
    /// <param name="textValue">The string to validate.</param>
    /// <returns>Returns true if the string is a valid Tempo ASCII-Value, and false otherwise.</returns>
    private static bool IsValidMetadataTextValue(ReadOnlySpan<char> textValue)
    {
        if (textValue.IsEmpty || textValue.IsWhiteSpace()) return false; // Empty strings are not allowed.
        // Must be a valid Tempo "ASCII-Value" as defined here:
        // This means printable ASCII (including/plus spaces); 0x20 to 0x7E inclusive.
        foreach (byte ch in textValue)
        {
            if (ch < 0x20 || ch > 0x7e)
            {
                return false;
            }
        }
        return true;
    }

    /// <summary>
    /// Checks if the given key corresponds to binary data.
    /// </summary>
    /// <param name="key">The metadata key.</param>
    /// <returns>True if the key has a "-bin" suffix, false otherwise.</returns>
    private static bool IsBinaryKey(string key) => key.EndsWith("-bin");

    /// <summary>
    /// Concatenates two or more Metadata instances into a new one.
    /// </summary>
    /// <param name="values">The Metadata instances to concatenate.</param>
    /// <returns>A new Metadata instance containing the concatenated values.</returns>
    /// <remarks> 
    /// If a key already exists, the values from the other instances will be appended.
    /// If a key does not exist, the values from the other instances will be set.
    /// </remarks>
    /// <exception cref="InvalidOperationException">Thrown if any of the Metadata instances are frozen.</exception>
    public static Metadata Concat(params Metadata[] values)
    {
        var result = new Metadata();
        foreach (var value in values)
        {
            result.Concat(value);
        }
        return result;
    }

    /// <summary>
    /// Creates a new Metadata instance from a Tempo HTTP header.
    /// </summary>
    /// <param name="header">The Tempo HTTP header.</param>
    /// <returns>A new Metadata instance.</returns>
    public static Metadata FromHttpHeader(string header)
    {
        var metadata = new Metadata();
        var entries = header.Split('|');
        foreach (var entry in entries)
        {
            var keyValuePair = entry.Split(':');
            if (keyValuePair.Length is not 2) throw new Exception("Invalid header format");
            var key = keyValuePair[0];
            var values = keyValuePair[1].Split(',');
            var unescapedKey = Unescape(key);
            foreach (var value in values)
            {
                var unescapedValue = Unescape(value);
                if (IsBinaryKey(unescapedKey))
                {
                    metadata.Append(unescapedKey, TempoUtils.Base64Decode(unescapedValue));
                }
                else
                {
                    metadata.Append(unescapedKey, unescapedValue);
                }
            }
        }
        return metadata;
    }

    #endregion
}