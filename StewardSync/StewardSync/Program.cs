using Microsoft.EntityFrameworkCore;
using StewardSync.Client.Pages;
using StewardSync.Components;
using StewardSync.Data;
using StewardSync.Services;
using StewardSync.Services.Authentication;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents();

// Add Entity Framework
builder.Services.AddDbContext<StewardSyncDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register custom services
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<AuthenticationService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore/hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(StewardSync.Client._Imports).Assembly);

// Create database on startup if it doesn't exist
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<StewardSyncDbContext>();
    context.Database.EnsureCreated();
}

app.Run();
