namespace Tempo.Core;

/// <summary>
/// Represents errors that occur during application execution relating to Tempo services.
/// </summary>
public class TempoException : Exception
{
    /// <summary>
    /// Gets the status code that defines the type of Tempo exception.
    /// </summary>
    public TempoStatusCode Status { get; private set; }

    /// <summary>
    /// Initializes a new instance of the <see cref="TempoException"/> class with a specified status code and error message.
    /// </summary>
    /// <param name="status">The status code of the exception.</param>
    /// <param name="message">The message that describes the error.</param>
    public TempoException(TempoStatusCode status, string message) : base(message)
    {
        Status = status;
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="TempoException"/> class with a specified status code and error message.
    /// </summary>
    /// <param name="status">The status code of the exception.</param>
    /// <param name="message">The message that describes the error.</param>
    /// <param name="inner">The inner exception.</param>
    public TempoException(TempoStatusCode status, string message, Exception inner) : base(message, inner)
    {
        Status = status;
    }

    /// <summary>
    /// Converts a Tempo status code to an HTTP status code implicitly.
    /// </summary>
    public static implicit operator int(TempoException exception) => TempoStatusToHttpStatus(exception.Status);

    /// <summary>
    /// Converts a Tempo status code to an HTTP status code.
    /// </summary>
    /// <param name="status">The Tempo status code.</param>
    /// <returns>The HTTP status code.</returns>
    public static TempoException HttpStatusToException(int httpStatus) => httpStatus switch {
        // Connectivity issues
        0 => new TempoException(TempoStatusCode.Internal, "Connectivity issues"),
        200 => new TempoException(TempoStatusCode.Ok, "OK"),
        400 => new TempoException(TempoStatusCode.InvalidArgument, "Invalid argument"),
        401 => new TempoException(TempoStatusCode.Unauthenticated, "Unauthenticated"),
        403 => new TempoException(TempoStatusCode.PermissionDenied, "Permission denied"),
        404 => new TempoException(TempoStatusCode.NotFound, "Not found"),
        409 => new TempoException(TempoStatusCode.Aborted, "Aborted"),
        412 => new TempoException(TempoStatusCode.FailedPrecondition, "Failed precondition"),
        429 => new TempoException(TempoStatusCode.ResourceExhausted, "Resource exhausted"),
        499 => new TempoException(TempoStatusCode.Cancelled, "Canceled"),
        500 => new TempoException(TempoStatusCode.Unknown, "Unknown error"),
        501 => new TempoException(TempoStatusCode.Unimplemented, "Unimplemented"),
        503 => new TempoException(TempoStatusCode.Unavailable, "Unavailable"),
        504 => new TempoException(TempoStatusCode.DeadlineExceeded, "Deadline exceeded"),
        _ => new TempoException(TempoStatusCode.Unknown, "Unknown error"),
    };

    /// <summary>
    /// Converts a Tempo status code to an HTTP status code.
    /// </summary>
    /// <param name="status">The Tempo status code.</param>
    /// <returns>The HTTP status code.</returns>
    public static int TempoStatusToHttpStatus(TempoStatusCode status) => status switch {
        TempoStatusCode.Ok => 200,
        TempoStatusCode.Cancelled => 499,
        TempoStatusCode.Unknown => 500,
        TempoStatusCode.InvalidArgument => 400,
        TempoStatusCode.DeadlineExceeded => 504,
        TempoStatusCode.NotFound => 404,
        TempoStatusCode.AlreadyExists => 409,
        TempoStatusCode.PermissionDenied => 403,
        TempoStatusCode.ResourceExhausted => 429,
        TempoStatusCode.FailedPrecondition => 412,
        TempoStatusCode.Aborted => 409,
        TempoStatusCode.OutOfRange => 400,
        TempoStatusCode.Unimplemented => 501,
        TempoStatusCode.Internal => 500,
        TempoStatusCode.Unavailable => 503,
        TempoStatusCode.DataLoss => 500,
        TempoStatusCode.Unauthenticated => 401,
        TempoStatusCode.UnknownContentType => 415,
        _ => 500,
    };
}
