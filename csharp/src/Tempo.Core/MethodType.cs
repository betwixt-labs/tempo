namespace Tempo.Core;

/// <summary>
/// Represents the type of Tempo method.
/// Each method type corresponds to a different communication model.
/// </summary>
public enum MethodType
{
    /// <summary>
    /// Unary method type.
    /// Represents a method where the client sends a single request and receives a single response.
    /// </summary>
    Unary,

    /// <summary>
    /// ServerStream method type.
    /// Represents a method where the client sends a single request and receives a stream of responses.
    /// </summary>
    ServerStream,

    /// <summary>
    /// ClientStream method type.
    /// Represents a method where the client sends a stream of requests and receives a single response.
    /// </summary>
    ClientStream,

    /// <summary>
    /// DuplexStream method type.
    /// Represents a method where the client and server send a stream of messages to each other simultaneously.
    /// </summary>
    DuplexStream,
}