using System.Collections;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Tempo.Core;

public class Credentials : Dictionary<string, object?>
{
    private static readonly JsonSerializerOptions _serializerOptions = new() {
        Converters = {
            new ObjectToInferredTypesConverter()
        }

    };


    public static Credentials? Parse(string credentials)
    {
        return JsonSerializer.Deserialize<Credentials>(System.Text.RegularExpressions.Regex.Unescape(credentials), _serializerOptions);
    }

    /// <summary>
    /// Returns a JSON representation of the credentials.
    /// </summary>
    public override string ToString()
    {
        return EncodeNonAsciiCharacters(JsonSerializer.Serialize(this, _serializerOptions));
    }

    private static string EncodeNonAsciiCharacters(string value)
    {
        var sb = new StringBuilder();
        foreach (char c in value)
        {
            if (c > 127)
            {
                string encodedValue = "\\u" + ((int)c).ToString("x4");
                sb.Append(encodedValue);
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    private static object? StringOrLong(ref Utf8JsonReader reader)
    {
        string? stringValue = reader.GetString();
        if (stringValue is not null && stringValue.EndsWith("||n"))
        {
            stringValue = stringValue[..^3];
            if (long.TryParse(stringValue, out var value))
            {
                return value;
            }
        }
        return stringValue;
    }

    public class ObjectToInferredTypesConverter : JsonConverter<object?>
    {
        public override object? Read(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options)
        {
            switch (reader.TokenType)
            {
                case JsonTokenType.True:
                    return true;
                case JsonTokenType.False:
                    return false;
                case JsonTokenType.Number when reader.TryGetInt32(out var intValue):
                    return intValue;
                case JsonTokenType.Number when reader.TryGetInt64(out var longValue):
                    return longValue;
                case JsonTokenType.Number:
                    return reader.GetDouble();
                case JsonTokenType.String when reader.TryGetDateTime(out var dateTime):
                    return dateTime;
                case JsonTokenType.String:
                    return StringOrLong(ref reader);
                case JsonTokenType.Null:
                    return null;
                case JsonTokenType.StartObject:
                    var dictionary = new Dictionary<string, object?>();
                    while (reader.Read())
                    {
                        if (reader.TokenType == JsonTokenType.EndObject)
                        {
                            dictionary.Remove("_map"); // Remove the _map flag
                            return dictionary;
                        }
                        else if (reader.TokenType == JsonTokenType.PropertyName)
                        {
                            string key = reader.GetString();
                            reader.Read();
                            dictionary[key] = Read(ref reader, typeToConvert, options);
                        }
                    }
                    return dictionary;
                case JsonTokenType.StartArray:
                    var list = new List<object?>();
                    while (reader.Read())
                    {
                        if (reader.TokenType == JsonTokenType.EndArray)
                            return list;
                        else
                            list.Add(Read(ref reader, typeToConvert, options));
                    }
                    return list;
                default:
                    throw new JsonException();
            }
        }

        public override void Write(
            Utf8JsonWriter writer,
            object? objectToWrite,
            JsonSerializerOptions options)
        {
            if (objectToWrite is IDictionary<string, object?> dictionary)
            {
                writer.WriteStartObject();
                foreach (var item in dictionary)
                {
                    writer.WritePropertyName(item.Key);
                    Write(writer, item.Value, options);
                }
                writer.WriteBoolean("_map", true);
                writer.WriteEndObject();
                return;
            }
            else if (objectToWrite is not null && objectToWrite.GetType() == typeof(long))
            {
                writer.WriteStringValue($"{objectToWrite}||n");
                return;
            }
            else
            {
                JsonSerializer.Serialize(writer, objectToWrite, objectToWrite.GetType(), options);
            }
        }
    }
}