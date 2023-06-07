namespace Tempo.Core.Tests;

using System.Text.Json;
using System.Text.Json.Nodes;
using Tempo.Core;

[TestClass]
public class CredentialsTests
{
    private static readonly Credentials _testCredentials = new() {
        ["token"] = "abc123",
        ["test"] = 9L,
        ["claims"] = new Dictionary<string, object?> {
            ["id😄😄😄"] = "user_123",
            ["email"] = "jane.doe@example.com",
            ["username"] = "jane_doe"
        },
        ["roles"] = new List<object> { "admin", "editor", 42, 7L, true, false },
        ["signature"] = "xyz789"
    };

    [TestMethod]
    public void Serialize_And_Parse()
    {
        var json = _testCredentials.ToString();
        var parsed = Credentials.Parse(json);
        Assert.IsNotNull(parsed);
        Assert.AreEqual(_testCredentials["token"], parsed["token"]);
        Assert.AreEqual(_testCredentials["signature"], parsed["signature"]);
        CollectionAssert.AreEqual(_testCredentials["claims"] as Dictionary<string, object?>,parsed["claims"] as Dictionary<string, object?>);
        CollectionAssert.AreEqual(_testCredentials["roles"] as List<object>,parsed["roles"] as List<object>);
    }
}