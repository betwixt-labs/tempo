using System.Globalization;

namespace Tempo.Core;

public interface ICancelableFunction : IDisposable
{
    void Cancel();
}

/// <summary>
/// A class to manage deadlines
/// </summary>
public class Deadline
{
    private const int MaxTimeOut = 2147483647;

    private readonly DateTimeOffset _deadlineValue;

    public Deadline(DateTimeOffset deadlineValue)
    {
        _deadlineValue = deadlineValue.ToUniversalTime();
    }

    public Deadline Min(params Deadline[] otherDeadlines)
    {
        var minValue = _deadlineValue.ToUnixTimeMilliseconds();
        foreach (var deadline in otherDeadlines)
        {
            long deadlineMsecs = deadline._deadlineValue.ToUnixTimeMilliseconds();
            if (deadlineMsecs < minValue)
            {
                minValue = deadlineMsecs;
            }
        }
        return new Deadline(DateTimeOffset.FromUnixTimeMilliseconds(minValue));
    }

    public double GetRelativeTimeout()
    {
        long deadlineMs = _deadlineValue.ToUnixTimeMilliseconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        long timeout = deadlineMs - now;
        return timeout switch {
            < 0 => 0,
            > MaxTimeOut => double.PositiveInfinity,
            _ => timeout
        };
    }
    /// <summary>
    /// Returns the deadline as a string in the format yyyy-MM-ddTHH:mm:ss.fffZ (ISO 8601)
    /// </summary>
    public override string ToString() => _deadlineValue.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

    public static Deadline FromISOString(string isoString)
    {
        if (!isoString.EndsWith('Z')) throw new ArgumentException("Provided ISO string is not in UTC format");
        isoString = isoString.TrimEnd('Z');
        if (!DateTimeOffset.TryParseExact(isoString, "yyyy-MM-ddTHH:mm:ss.fff",
            CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var result))
        {
            throw new ArgumentException("Invalid ISO string format");
        }
        return new Deadline(result);
    }

    /// <summary>
    /// Returns the deadline as a Unix timestamp in milliseconds
    /// </summary>
    public long UnixTimestamp => _deadlineValue.ToUnixTimeMilliseconds();

    public static Deadline FromUnixTimestamp(long unixTimestamp)
    {
        return new Deadline(DateTimeOffset.FromUnixTimeMilliseconds(unixTimestamp));
    }

    public bool IsBefore(Deadline other)
    {
        return UnixTimestamp < other.UnixTimestamp;
    }

    public bool IsExpired()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() >= UnixTimestamp;
    }

    public static Deadline After(TimeSpan duration)
    {
        return new Deadline(DateTimeOffset.UtcNow + duration);
    }

    public static Deadline Infinite()
    {
        return After(TimeSpan.FromMilliseconds(MaxTimeOut));
    }

    public long TimeRemaining()
    {
        return Math.Max(UnixTimestamp - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), 0);
    }

    public async Task<T> ExecuteWithinDeadline<T>(Func<CancellationToken, Task<T>> func, CancellationToken cancellationToken = default)
    {
        using var timeoutSource = new CancellationTokenSource();
        timeoutSource.CancelAfter(TimeSpan.FromMilliseconds(GetRelativeTimeout()));
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(timeoutSource.Token, cancellationToken);
        try
        {
            return await func(cts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException tcx) when (cancellationToken.IsCancellationRequested) {
            throw new TempoException(TempoStatusCode.Cancelled, "Request cancelled by caller.", tcx);
        }
        catch (OperationCanceledException ocx) when (timeoutSource.IsCancellationRequested)
        {
            throw new TempoException(TempoStatusCode.DeadlineExceeded, "RPC deadline exceeded.", ocx);
        }
    }

    public ICancelableFunction RunOnExpiration(Action action)
    {
        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        long deadline = UnixTimestamp;
        int timeout = (int)Math.Max(deadline - now, 0);
        return new CancelableFunctionImpl(timeout, action);
    }

    private class CancelableFunctionImpl : ICancelableFunction
    {
        private readonly Action _cancelAction;
        private readonly Timer _timer;

        public CancelableFunctionImpl(int timeout, Action cancelAction)
        {
            _cancelAction = cancelAction;
            _timer = new Timer(_ => _cancelAction(), null, timeout, Timeout.Infinite);
        }

        public void Cancel() => Dispose();

        public void Dispose()
        {
            _timer.Dispose();
        }
    }
}