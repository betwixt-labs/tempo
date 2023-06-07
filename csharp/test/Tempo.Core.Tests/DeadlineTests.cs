namespace Tempo.Core.Tests;
using Tempo.Core;

[TestClass]
public class DeadlineTests
{
    [TestMethod]
    public async Task Execute_Within_Deadline()
    {
        var deadline = Deadline.After(TimeSpan.FromSeconds(1));
        var result = await deadline.ExecuteWithinDeadline(async ct => {
            await Task.Delay(500, ct);
            return "Success";
        });
        Assert.AreEqual("Success", result);
    }

    [TestMethod]
    [ExpectedException(typeof(TempoException))]
    public async Task Execute_Within_Deadline_Throws()
    {
        var deadline = Deadline.After(TimeSpan.FromMilliseconds(1));
        await deadline.ExecuteWithinDeadline(async ct => {
            await Task.Delay(500, ct);
            return "Success";
        });
    }

    [TestMethod]
    [ExpectedException(typeof(TempoException))]
    public async Task Execute_Within_Deadline_Throws_When_Canceled()
    {
        var deadline = Deadline.After(TimeSpan.FromSeconds(10));
        var cancellationTokenSource = new CancellationTokenSource();
        cancellationTokenSource.CancelAfter(1);  // Cancel after 1 second
        var value = await deadline.ExecuteWithinDeadline(async ct => {
            await Task.Delay(500, ct);
            return "Success";
        }, cancellationTokenSource.Token);
    }

    [TestMethod]
    public void From_Unix_Timestamp()
    {
        var now = DateTimeOffset.UtcNow;
        var unixTimestamp = now.ToUnixTimeMilliseconds();
        var deadline = Deadline.FromUnixTimestamp(unixTimestamp);
        // Account for possible slight time differences
        Assert.IsTrue(Math.Abs(now.ToUnixTimeMilliseconds() - deadline.UnixTimestamp) < 1);
    }

    [TestMethod]
    public void Is_Before()
    {
        var deadline1 = Deadline.After(TimeSpan.FromSeconds(1));
        var deadline2 = Deadline.After(TimeSpan.FromSeconds(2));
        Assert.IsTrue(deadline1.IsBefore(deadline2));
    }

    [TestMethod]
    public void Time_Remaining()
    {
        var deadline = Deadline.After(TimeSpan.FromSeconds(1));
        var remaining = deadline.TimeRemaining();

        Assert.IsTrue(remaining > 0 && remaining <= 1000);
    }

    [TestMethod]
    public void Infinite_Deadline()
    {
        var deadline = Deadline.Infinite();
        var remaining = deadline.TimeRemaining();
        Assert.AreEqual(int.MaxValue, remaining);
    }

    [TestMethod]
    public async Task Run_On_Expiration()
    {
        var deadline = Deadline.After(TimeSpan.FromSeconds(1));
        bool actionCalled = false;
        deadline.RunOnExpiration(() => actionCalled = true);
        await Task.Delay(2000);  // Wait for more than 1 second
        Assert.IsTrue(actionCalled);
    }

    [TestMethod]
    public void From_ISO_String()
    {
        var isoString = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        var deadline = Deadline.FromISOString(isoString);
        var outputString = deadline.ToString();
        // Removing 'Z' from the end as ToString() function doesn't append 'Z' at the end.
        Assert.AreEqual(isoString, outputString);
    }
}