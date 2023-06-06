namespace Tempo.Core;

/// <summary>
/// Enum representing possible status codes.
/// </summary>
public enum TempoStatusCode
{
    /// <summary>
    /// Not an error; returned on success.
    /// </summary>
    Ok = 0,

    /// <summary>
    /// The operation was cancelled, typically by the caller.
    /// </summary>
    Cancelled = 1,

    /// <summary>
    /// Unknown error.
    /// For example, this error may be returned when a Status value received from another address space belongs
    /// to an error space that is not known in this address space.
    /// Also errors raised by APIs that do not return enough error information may be converted to this error.
    /// </summary>
    Unknown = 2,

    /// <summary>
    /// The client specified an invalid argument.
    /// Note that this differs from FailedPrecondition.
    /// InvalidArgument indicates arguments that are problematic regardless of the state of the system
    /// (e.g., a malformed file name).
    /// </summary>
    InvalidArgument = 3,

    /// <summary>
    /// The deadline expired before the operation could complete.
    /// For operations that change the state of the system, this error may be returned even if the operation
    /// has completed successfully. For example, a successful response from a server could have been delayed long.
    /// </summary>
    DeadlineExceeded = 4,

    /// <summary>
    /// Some requested entity (e.g., file or directory) was not found.
    /// Note to server developers: if a request is denied for an entire class of users, such as gradual
    /// feature rollout or undocumented allowlist, NotFound may be used. If a request is denied for some users
    /// within a class of users, such as user-based access control, PermissionDenied must be used.
    /// </summary>
    NotFound = 5,

    /// <summary>
    /// The entity that a client attempted to create (e.g., file or directory) already exists.
    /// </summary>
    AlreadyExists = 6,

    /// <summary>
    /// The caller does not have permission to execute the specified operation.
    /// PermissionDenied must not be used for rejections caused by exhausting some resource
    /// (use ResourceExhausted instead for those errors).
    /// PermissionDenied must not be used if the caller can not be identified
    /// (use Unauthenticated instead for those errors). This error code does not imply the request is valid or
    /// the requested entity exists or satisfies other pre-conditions.
    /// </summary>
    PermissionDenied = 7,

    /// <summary>
    /// Some resource has been exhausted, perhaps a per-user quota, or perhaps the entire file system is out of space.
    /// </summary>
    ResourceExhausted = 8,

    /// <summary>
    /// The operation was rejected because the system is not in a state required for the operation's execution.
    /// For example, the directory to be deleted is non-empty, an rmdir operation is applied to a non-directory, etc.
    /// Service implementors can use the following guidelines to decide between FailedPrecondition, Aborted, and Unavailable:
    /// (a) Use Unavailable if the client can retry just the failing call.
    /// (b) Use Aborted if the client should retry at a higher level
    /// (e.g., when a client-specified test-and-set fails, indicating the client should restart a read-modify-write sequence).
    /// (c) Use FailedPrecondition if the client should not retry until the system state has been explicitly fixed.
    /// E.g., if an "rmdir" fails because the directory is non-empty, FailedPrecondition should be returned since
    /// the client should not retry unless the files are deleted from the directory.
    /// </summary>
    FailedPrecondition = 9,

    /// <summary>
    /// The operation was aborted, typically due to a concurrency issue such as a sequencer check failure or transaction abort.
    /// See the guidelines above for deciding between FailedPrecondition, Aborted, and Unavailable.
    /// </summary>
    Aborted = 10,

    /// <summary>
    /// The operation was attempted past the valid range.
    /// E.g., seeking or reading past end-of-file. Unlike InvalidArgument, this error indicates a problem that may be fixed
    /// if the system state changes. For example, a 32-bit file system will generate InvalidArgument if asked to read
    /// at an offset that is not in the range [0,2^32-1], but it will generate OutOfRange if asked to read from an offset
    /// past the current file size. There is a fair bit of overlap between FailedPrecondition and OutOfRange.
    /// We recommend using OutOfRange (the more specific error) when it applies so that callers who are iterating through
    /// a space can easily look for an OutOfRange error to detect when they are done.
    /// </summary>
    OutOfRange = 11,

    /// <summary>
    /// The operation is not implemented or is not supported/enabled in this service.
    /// </summary>
    Unimplemented = 12,

    /// <summary>
    /// Internal errors. This means that some invariants expected by the underlying system have been broken.
    /// This error code is reserved for serious errors.
    /// </summary>
    Internal = 13,

    /// <summary>
    /// The service is currently unavailable. This is most likely a transient condition, which can be corrected by
    /// retrying with a backoff. Note that it is not always safe to retry non-idempotent operations.
    /// </summary>
    Unavailable = 14,

    /// <summary>
    /// Unrecoverable data loss or corruption.
    /// </summary>
    DataLoss = 15,

    /// <summary>
    /// The request does not have valid authentication credentials for the operation.
    /// </summary>
    Unauthenticated = 16,

    /// <summary>
    /// The request does not have a valid or known content type, so it cannot be marshaled.
    /// </summary>
    UnknownContentType = 17,
}