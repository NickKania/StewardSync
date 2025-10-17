using Microsoft.EntityFrameworkCore;
using StewardSync.Data;
using StewardSync.Models;

namespace StewardSync.Services
{
    public class ReportService
    {
        private readonly StewardSyncDbContext _context;

        public ReportService(StewardSyncDbContext context)
        {
            _context = context;
        }

        public async Task<List<Report>> GetAllReportsAsync()
        {
            return await _context.Reports
                .Include(r => r.ReportingDriver)
                .Include(r => r.ReportedDriver)
                .Include(r => r.Event)
                .Include(r => r.Race)
                .OrderByDescending(r => r.ReportDate)
                .ToListAsync();
        }

        public async Task<Report?> GetReportByIdAsync(int id)
        {
            return await _context.Reports
                .Include(r => r.ReportingDriver)
                .Include(r => r.ReportedDriver)
                .Include(r => r.Event)
                .Include(r => r.Race)
                .Include(r => r.Reviews)
                    .ThenInclude(review => review.User)
                        .ThenInclude(user => user.Role)
                .FirstOrDefaultAsync(r => r.ReportId == id);
        }

        public async Task<List<Report>> GetUnfinalizedReportsAsync()
        {
            return await _context.Reports
                .Include(r => r.ReportingDriver)
                .Include(r => r.ReportedDriver)
                .Include(r => r.Event)
                .Include(r => r.Race)
                .Where(r => !r.IsFinalized)
                .OrderByDescending(r => r.ReportDate)
                .ToListAsync();
        }

        public async Task<Report> CreateReportAsync(Report report)
        {
            // Validate that reporting and reported drivers are different
            if (report.ReportingDriverId == report.ReportedDriverId)
            {
                throw new ArgumentException("Reporting driver and reported driver cannot be the same.");
            }

            // Validate that the race belongs to the event
            var race = await _context.Races.FindAsync(report.RaceId);
            if (race == null || race.EventId != report.EventId)
            {
                throw new ArgumentException("The selected race does not belong to the selected event.");
            }

            _context.Reports.Add(report);
            await _context.SaveChangesAsync();
            return report;
        }

        public async Task<Report> UpdateReportAsync(Report report)
        {
            if (report.IsFinalized)
            {
                throw new InvalidOperationException("Cannot update a finalized report.");
            }

            _context.Entry(report).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return report;
        }

        public async Task FinalizeReportAsync(int reportId)
        {
            var report = await _context.Reports.FindAsync(reportId);
            if (report == null)
            {
                throw new ArgumentException("Report not found.");
            }

            if (report.IsFinalized)
            {
                throw new InvalidOperationException("Report is already finalized.");
            }

            report.IsFinalized = true;
            await _context.SaveChangesAsync();
        }

        public async Task<List<Driver>> GetAllDriversAsync()
        {
            return await _context.Drivers
                .OrderBy(d => d.DriverNumber)
                .ToListAsync();
        }

        public async Task<List<Event>> GetAllEventsAsync()
        {
            return await _context.Events
                .OrderByDescending(e => e.EventDate)
                .ToListAsync();
        }

        public async Task<List<Race>> GetRacesByEventIdAsync(int eventId)
        {
            return await _context.Races
                .Where(r => r.EventId == eventId)
                .OrderBy(r => r.RaceNumber)
                .ToListAsync();
        }
    }
}
