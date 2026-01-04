using Microsoft.EntityFrameworkCore;
using StewardSync.Data;
using StewardSync.Models;

namespace StewardSync.Services
{
    public class ReviewService
    {
        private readonly StewardSyncDbContext _context;

        public ReviewService(StewardSyncDbContext context)
        {
            _context = context;
        }

        public async Task<List<Review>> GetAllReviewsAsync()
        {
            return await _context.Reviews
                .Include(r => r.User)
                    .ThenInclude(u => u.Role)
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportingDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportedDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Event)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Race)
                .OrderByDescending(r => r.ReviewDate)
                .ToListAsync();
        }

        public async Task<Review?> GetReviewByIdAsync(int id)
        {
            return await _context.Reviews
                .Include(r => r.User)
                    .ThenInclude(u => u.Role)
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportingDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportedDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Event)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Race)
                .FirstOrDefaultAsync(r => r.ReviewId == id);
        }

        public async Task<List<Review>> GetReviewsByReportIdAsync(int reportId)
        {
            return await _context.Reviews
                .Include(r => r.User)
                    .ThenInclude(u => u.Role)
                .Where(r => r.ReportId == reportId)
                .OrderBy(r => r.ReviewDate)
                .ToListAsync();
        }

        public async Task<List<Review>> GetReviewsByUserIdAsync(int userId)
        {
            return await _context.Reviews
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportingDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.ReportedDriver)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Event)
                .Include(r => r.Report)
                    .ThenInclude(report => report.Race)
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.ReviewDate)
                .ToListAsync();
        }

        public async Task<Review> CreateReviewAsync(Review review)
        {
            // Validate that the report exists and is not finalized
            var report = await _context.Reports.FindAsync(review.ReportId);
            if (report == null)
            {
                throw new ArgumentException("Report not found.");
            }

            if (report.Status == ReportStatus.DecisionReached || report.Status == ReportStatus.Closed)
            {
                throw new InvalidOperationException("Cannot review a finalized report.");
            }

            // Validate that the user exists and has appropriate role
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserId == review.UserId);

            if (user == null)
            {
                throw new ArgumentException("User not found.");
            }

            if (!CanUserReview(user.Role.RoleName))
            {
                throw new InvalidOperationException("User does not have permission to review reports.");
            }

            // Check if user has already reviewed this report
            var existingReview = await _context.Reviews
                .FirstOrDefaultAsync(r => r.ReportId == review.ReportId && r.UserId == review.UserId);

            if (existingReview != null)
            {
                throw new InvalidOperationException("User has already reviewed this report.");
            }

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();
            return review;
        }

        public async Task<Review> UpdateReviewAsync(Review review)
        {
            var existingReview = await _context.Reviews.FindAsync(review.ReviewId);
            if (existingReview == null)
            {
                throw new ArgumentException("Review not found.");
            }

            // Check if the associated report is not finalized
            var report = await _context.Reports.FindAsync(existingReview.ReportId);
            if (report != null && (report.Status == ReportStatus.DecisionReached || report.Status == ReportStatus.Closed))
            {
                throw new InvalidOperationException("Cannot update a review for a finalized report.");
            }

            _context.Entry(review).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return review;
        }

        public async Task DeleteReviewAsync(int reviewId)
        {
            var review = await _context.Reviews.FindAsync(reviewId);
            if (review == null)
            {
                throw new ArgumentException("Review not found.");
            }

            // Check if the associated report is not finalized
            var report = await _context.Reports.FindAsync(review.ReportId);
            if (report != null && (report.Status == ReportStatus.DecisionReached || report.Status == ReportStatus.Closed))
            {
                throw new InvalidOperationException("Cannot delete a review for a finalized report.");
            }

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();
        }

        public async Task<List<User>> GetUsersWithReviewPermissionsAsync()
        {
            return await _context.Users
                .Include(u => u.Role)
                .Where(u => CanUserReview(u.Role.RoleName))
                .OrderBy(u => u.UserName)
                .ToListAsync();
        }

        private bool CanUserReview(string roleName)
        {
            return roleName == "Steward" || roleName == "Head Steward" || roleName == "Event Manager";
        }

        private bool CanUserFinalize(string roleName)
        {
            return roleName == "Head Steward" || roleName == "Event Manager";
        }

        public bool CanUserFinalizeReport(User user)
        {
            return CanUserFinalize(user.Role.RoleName);
        }
    }
}
