using Microsoft.EntityFrameworkCore;
using StewardSync.Models;

namespace StewardSync.Data
{
    public class StewardSyncDbContext : DbContext
    {
        public StewardSyncDbContext(DbContextOptions<StewardSyncDbContext> options) : base(options)
        {
        }

        // DbSets for each model
        public DbSet<Report> Reports { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<Driver> Drivers { get; set; }
        public DbSet<Event> Events { get; set; }
        public DbSet<Race> Races { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure relationships

            // Report relationships
            modelBuilder.Entity<Report>()
                .HasOne(r => r.ReportingDriver)
                .WithMany(d => d.FiledReports)
                .HasForeignKey(r => r.ReportingDriverId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.ReportedDriver)
                .WithMany(d => d.ReportedIncidents)
                .HasForeignKey(r => r.ReportedDriverId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Event)
                .WithMany(e => e.Reports)
                .HasForeignKey(r => r.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Race)
                .WithMany(race => race.Reports)
                .HasForeignKey(r => r.RaceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Review relationships
            modelBuilder.Entity<Review>()
                .HasOne(r => r.User)
                .WithMany(u => u.Reviews)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Review>()
                .HasOne(r => r.Report)
                .WithMany(r => r.Reviews)
                .HasForeignKey(r => r.ReportId)
                .OnDelete(DeleteBehavior.Cascade);

            // User relationships
            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            // Race relationships
            modelBuilder.Entity<Race>()
                .HasOne(r => r.Event)
                .WithMany(e => e.Races)
                .HasForeignKey(r => r.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            // Seed initial data
            SeedData(modelBuilder);
        }

        private void SeedData(ModelBuilder modelBuilder)
        {
            // Seed roles
            var roles = new[]
            {
                new Role { RoleId = 1, RoleName = "Driver" },
                new Role { RoleId = 2, RoleName = "Steward" },
                new Role { RoleId = 3, RoleName = "Head Steward" },
                new Role { RoleId = 4, RoleName = "Event Manager" }
            };

            modelBuilder.Entity<Role>().HasData(roles);

            // Seed sample users (in production, these would be created through proper user management)
            var users = new[]
            {
                new User { UserId = 1, UserName = "headsteward", RoleId = 3 },
                new User { UserId = 2, UserName = "steward1", RoleId = 2 },
                new User { UserId = 3, UserName = "eventmanager", RoleId = 4 },
                new User { UserId = 4, UserName = "driver1", RoleId = 1 }
            };

            modelBuilder.Entity<User>().HasData(users);

            // Seed sample drivers
            var drivers = new[]
            {
                new Driver { DriverId = 1, DriverNumber = 1, DriverName = "John Smith", ExternalId = "EXT001", DriverClass = "Pro" },
                new Driver { DriverId = 2, DriverNumber = 2, DriverName = "Jane Doe", ExternalId = "EXT002", DriverClass = "Pro" },
                new Driver { DriverId = 3, DriverNumber = 3, DriverName = "Bob Johnson", ExternalId = "EXT003", DriverClass = "Amateur" },
                new Driver { DriverId = 4, DriverNumber = 4, DriverName = "Alice Brown", ExternalId = "EXT004", DriverClass = "Amateur" }
            };

            modelBuilder.Entity<Driver>().HasData(drivers);

            // Seed sample events
            var events = new[]
            {
                new Event { EventId = 1, Series = "Formula 1", EventNumber = 1, TrackName = "Silverstone", EventDate = new DateTime(2024, 7, 7) },
                new Event { EventId = 2, Series = "Formula 1", EventNumber = 2, TrackName = "Monza", EventDate = new DateTime(2024, 9, 1) },
                new Event { EventId = 3, Series = "GT Racing", EventNumber = 1, TrackName = "Laguna Seca", EventDate = new DateTime(2024, 5, 15) }
            };

            modelBuilder.Entity<Event>().HasData(events);

            // Seed sample races
            var races = new[]
            {
                new Race { RaceId = 1, EventId = 1, RaceNumber = 1 },
                new Race { RaceId = 2, EventId = 1, RaceNumber = 2 },
                new Race { RaceId = 3, EventId = 2, RaceNumber = 1 },
                new Race { RaceId = 4, EventId = 3, RaceNumber = 1 }
            };

            modelBuilder.Entity<Race>().HasData(races);
        }
    }
}
