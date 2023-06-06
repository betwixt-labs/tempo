using System.Buffers;
using System.Buffers.Text;
using System.Text;

namespace Tempo.Core;

public static class TempoUtils
{
    /// <summary>
    /// Base64-encodes the given data.
    /// </summary>
    /// <param name="data">The data to encode.</param>
    /// <returns>The base64-encoded data.</returns>
    /// <exception cref="ArgumentException">Thrown if the data cannot be encoded.</exception>
    internal static string Base64Encode(ReadOnlySpan<byte> data)
    {
        var base64Length = Base64.GetMaxEncodedToUtf8Length(data.Length);
        const int MaxStackSize = 256;
        byte[]? rentedFromPool = null;
        Span<byte> buffer = base64Length > MaxStackSize ? (rentedFromPool = ArrayPool<byte>.Shared.Rent(base64Length)) : stackalloc byte[MaxStackSize];
        try
        {
            var status = Base64.EncodeToUtf8(data, buffer, out int bytesConsumed, out int bytesWritten);
            if (status is not OperationStatus.Done)
            {
                throw new ArgumentException($"Failed to base64-encode message", nameof(data));
            }
            return Encoding.ASCII.GetString(buffer[..bytesWritten]);
        }
        finally
        {
            if (rentedFromPool is not null)
            {
                ArrayPool<byte>.Shared.Return(rentedFromPool);
            }
        }
    }

    /// <summary>
    /// Base64-decodes the given data.
    /// </summary>
    /// <param name="encoded">The data to decode.</param>
    /// <returns>The base64-decoded data.</returns>
    /// <exception cref="ArgumentException">Thrown if the data cannot be decoded.</exception>
    internal static byte[] Base64Decode(string encoded)
    {
        // Decode the base64 in a way that doesn't allocate
        int encodedByteCount = Encoding.UTF8.GetByteCount(encoded);
        byte[] buffer = ArrayPool<byte>.Shared.Rent(encodedByteCount);
        try
        {
            Encoding.UTF8.GetBytes(encoded, 0, encoded.Length, buffer, 0);
            OperationStatus status = Base64.DecodeFromUtf8InPlace(buffer.AsSpan(0, encodedByteCount), out int bytesWritten);
            if (status is not OperationStatus.Done)
            {
                throw new ArgumentException($"Failed to base64-decode encoded message", nameof(encoded));
            }
            // we allocate here to return a slice of the buffer
            return buffer.AsSpan(0, bytesWritten).ToArray();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }
}