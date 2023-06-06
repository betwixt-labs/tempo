namespace Tempo.Core.Tests;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Tempo.Core;

[TestClass]
public class TempoExceptionTests
{
    [TestMethod]
    public void HttpStatusToException_ReturnsCorrectException()
    {
        // Arrange
        int httpStatus = 404;
        // Act
        var exception = TempoException.HttpStatusToException(httpStatus);
        // Assert
        Assert.AreEqual(TempoStatusCode.NotFound, exception.Status);
        Assert.AreEqual("Not found", exception.Message);
    }

    [TestMethod]
    public void TempoStatusToHttpStatus_ReturnsCorrectHttpStatus()
    {
        // Arrange
        var status = TempoStatusCode.NotFound;

        // Act
        var httpStatus = TempoException.TempoStatusToHttpStatus(status);

        // Assert
        Assert.AreEqual(404, httpStatus);
    }

    [TestMethod]
    public void ImplicitOperator_ReturnsCorrectHttpStatus()
    {
        // Arrange
        var exception = new TempoException(TempoStatusCode.NotFound, "Not found");

        // Act
        int httpStatus = exception;

        // Assert
        Assert.AreEqual(404, httpStatus);
    }
}