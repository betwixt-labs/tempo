namespace Tempo.Core.Tests;
using Tempo.Core;

[TestClass]
public class TempUtilsTests
{
    [TestMethod]
    public void TestBase64_Encode()
    {
        // Arrange
        var input = new byte[] { 1, 2, 3, 4, 5 };
        // Act
        var encoded = TempoUtils.Base64Encode(input);
        // Assert
        Assert.AreEqual("AQIDBAU=", encoded);
    }

    [TestMethod]
    public void TestBase64_Decode()
    {
        // Arrange
        var encoded = "AQIDBAU=";
        // Act
        var decoded = TempoUtils.Base64Decode(encoded);
        // Assert
        CollectionAssert.AreEqual(new byte[] { 1, 2, 3, 4, 5 }, decoded);
    }

    [TestMethod]
    public void TestBase64Encode_Decode_Padding()
    {
        // Arrange
        var input = new byte[] { 1, 2, 3, 4, 5, 6, 7 };

        // Act
        var encoded = TempoUtils.Base64Encode(input);
        var decoded = TempoUtils.Base64Decode(encoded);

        // Assert
        CollectionAssert.AreEqual(input, decoded);
    }

    [TestMethod]
    public void TestBase64Encode_Decode_EmptyArray()
    {
        // Arrange
        var input = Array.Empty<byte>();

        // Act
        var encoded = TempoUtils.Base64Encode(input);
        var decoded = TempoUtils.Base64Decode(encoded);

        // Assert
        CollectionAssert.AreEqual(input, decoded);
    }
    [TestMethod]
    public void TestBase64Encode_Decode_RandomData()
    {
        // Arrange
        var random = new Random();
        var input = new byte[100];
        random.NextBytes(input);

        // Act
        var encoded = TempoUtils.Base64Encode(input);
        var decoded = TempoUtils.Base64Decode(encoded);

        // Assert
        CollectionAssert.AreEqual(input, decoded);
    }

    [TestMethod]
    public void TestBase64Encode_Decode_Fuzzing()
    {
        // Arrange
        var random = new Random();
        const int MaxInputSize = 1000;
        const int MaxIterations = 1000;

        for (int i = 0; i < MaxIterations; i++)
        {
            // Generate random input
            var inputSize = random.Next(MaxInputSize);
            var input = new byte[inputSize];
            random.NextBytes(input);

            // Act
            var encoded = TempoUtils.Base64Encode(input);
            var decoded = TempoUtils.Base64Decode(encoded);

            // Assert
            CollectionAssert.AreEqual(input, decoded);
        }
    }
}