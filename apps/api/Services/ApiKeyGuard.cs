using System.Security.Cryptography;
using System.Text;

namespace Parallax.Api.Services;

public static class ApiKeyGuard
{
    public static bool IsValid(HttpRequest request, IConfiguration configuration)
    {
        var expected = configuration["PARALLAX_API_KEY"];
        if (string.IsNullOrWhiteSpace(expected)) return false;
        var supplied = request.Headers["X-API-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(supplied) && request.Headers.Authorization.FirstOrDefault() is { } authorization && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            supplied = authorization[7..].Trim();
        if (string.IsNullOrWhiteSpace(supplied)) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(supplied), Encoding.UTF8.GetBytes(expected));
    }
}
