using Microsoft.AspNetCore.Components.Authorization;
using System.Security.Claims;

namespace StewardSync.Services.Authentication
{
    public class CustomAuthenticationStateProvider : AuthenticationStateProvider
    {
        private readonly AuthenticationService _authService;

        public CustomAuthenticationStateProvider(AuthenticationService authService)
        {
            _authService = authService;
            // Set up the callback to notify when authentication state changes
            _authService.SetAuthenticationChangedCallback(NotifyAuthenticationChanged);
        }

        public override async Task<AuthenticationState> GetAuthenticationStateAsync()
        {
            var identity = new ClaimsIdentity();
            
            if (_authService.IsAuthenticated && _authService.CurrentUser != null)
            {
                var claims = new[]
                {
                    new Claim(ClaimTypes.Name, _authService.CurrentUser.UserName),
                    new Claim(ClaimTypes.NameIdentifier, _authService.CurrentUser.UserId.ToString()),
                    new Claim(ClaimTypes.Role, _authService.CurrentUser.Role.RoleName),
                    new Claim("RoleId", _authService.CurrentUser.Role.RoleId.ToString())
                };
                
                identity = new ClaimsIdentity(claims, "custom");
            }

            return await Task.FromResult(new AuthenticationState(new ClaimsPrincipal(identity)));
        }

        public void NotifyAuthenticationChanged()
        {
            NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
        }
    }
}
