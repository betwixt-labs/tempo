using System.Buffers;
using System.Buffers.Text;
using System.Collections.ObjectModel;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Unicode;

namespace Tempo.Core;

public partial class Metadata
{
    private readonly Dictionary<string, string[]> _metadata;
    private bool _isFrozen;

    public Metadata()
    {
        _metadata = new Dictionary<string, string[]>();
        _isFrozen = false;
    }
    public int Size => _metadata.Count;


    public void Freeze()
    {
        _isFrozen = true;
    }

    public void Set(string key, string value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        key = key.ToLowerInvariant();
        InnerSet(key, value);
    }

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

    public void Append(string key, string value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        key = key.ToLowerInvariant();
        InnerAppend(key, value);
    }

    public void Append(string key, byte[] value)
    {
        if (_isFrozen) throw new InvalidOperationException("Metadata is frozen");
        if (!IsValidKey(key)) throw new ArgumentException("Invalid metadata key");
        if (!IsBinaryKey(key)) throw new ArgumentException("Key is not a binary key");
        key = key.ToLowerInvariant();
        InnerAppend(key,  Base64Url.Encode(value));
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

    public string[]? Get(string key)
    {
        key = key.ToLowerInvariant();
        if (!_metadata.TryGetValue(key, out string[]? values)) return null;
        return values;
    }

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
            var otherValue = otherMetadata.Get(key);
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
                    metadata.Append(unescapedKey, Base64Url.Decode(unescapedValue));
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