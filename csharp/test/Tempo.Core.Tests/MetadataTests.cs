namespace Tempo.Core.Tests;
using Tempo.Core;

[TestClass]
public class MetadataTests
{
    [TestMethod]
    public void Set_Key()
    {
        var metadata = new Metadata();
        metadata.Set("key1", "value1");
        metadata.Set("key2", "value2");

        Assert.AreEqual(metadata.Size, 2);

        Assert.AreEqual("value1", metadata.GetTextValues("key1")![0]);
        Assert.AreEqual("value2", metadata.GetTextValues("key2")![0]);
    }

    [TestMethod]
    public void Overwrite_Key()
    {
        // Arrange
        var metadata = new Metadata();
        metadata.Set("key1", "value");
        metadata.Set("key1", "value2");

        // Assert
        Assert.AreEqual(metadata.Size, 1);
        Assert.AreEqual("value2", metadata.GetTextValues("key1")![0]);
    }

    [TestMethod]
    public void Set_And_Get_Binary_Values()
    {
        // Arrange
        var metadata = new Metadata();
        var bytes = new byte[] { 1, 2, 3, 4, 5 };
        metadata.Set("key1-bin", bytes);
        // Act
        var result = metadata.GetBinaryValues("key1-bin")![0];
        // Assert
        CollectionAssert.AreEqual(bytes, result);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentException))]
    public void Throw_Invalid_Key()
    {
        var metadata = new Metadata();
        metadata.Set("🔥", "value");
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentException))]
    public void Expect_Binary_Key()
    {
        var metadata = new Metadata();
        var data = Array.Empty<byte>();
        metadata.Set("key", data);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentException))]
    public void Edge_Case_Key()
    {
        var metadata = new Metadata();
        metadata.Set("key1;|", "value1;|");
    }

    [TestMethod]
    public void ToHttpHeader_Roundtrip()
    {
        var metadata = new Metadata();
        metadata.Set("key1", "value1");
        metadata.Set("key2", "value2");
        metadata.Append("key2", "value3");
        metadata.Set("key3-bin", new byte[] { 1, 2, 3, 4, 5 });

        var header = metadata.ToHttpHeader();
        var metadata2 = Metadata.FromHttpHeader(header);

        Assert.AreEqual(metadata.Size, metadata2.Size);

        Assert.AreEqual(metadata.GetTextValues("key1")![0], metadata2.GetTextValues("key1")![0]);
        Assert.AreEqual(metadata.GetTextValues("key2")![0], metadata2.GetTextValues("key2")![0]);
        Assert.AreEqual(metadata.GetTextValues("key2")![1], metadata2.GetTextValues("key2")![1]);
        CollectionAssert.AreEqual(metadata.GetBinaryValues("key3-bin")![0], metadata2.GetBinaryValues("key3-bin")![0]);
    }

    [TestMethod]
    public void ToHttpHeader_Roundtrip_Fuzz()
    {
        var random = new Random();
        var metadata = new Metadata();
        // Generate random metadata
        for (int i = 0; i < 100; i++)
        {
            var key = GenerateRandomString(random, 10);
            var value = GenerateRandomString(random, 20);
            metadata.Set(key, value);
        }
        // Convert metadata to HTTP header string
        var httpHeader = metadata.ToHttpHeader();
        var result = Metadata.FromHttpHeader(httpHeader);
        Assert.AreEqual(metadata.Size, result.Size);
        CollectionAssert.AreEqual(metadata.Keys, result.Keys);
        Assert.AreEqual(metadata.ToHttpHeader(), result.ToHttpHeader());
    }

    private string GenerateRandomString(Random random, int length)
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return new string(Enumerable.Repeat(chars, length)
          .Select(s => s[random.Next(s.Length)]).ToArray());
    }

}