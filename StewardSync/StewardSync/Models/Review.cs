using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Review
    {
        public int ReviewId { get; set; }

        [DataType(DataType.DateTime)]
        public DateTime ReviewDate { get; set; } = DateTime.UtcNow;

        [Required]
        public int UserId { get; set; }

        [Required]
        public int ReportId { get; set; }

        [Required]
        [StringLength(2000, MinimumLength = 10, ErrorMessage = "Analysis must be between 10 and 2000 characters")]
        public string Analysis { get; set; } = string.Empty;

        [StringLength(1000, ErrorMessage = "Notes cannot exceed 1000 characters")]
        public string? Notes { get; set; }

        // Navigation properties
        public User User { get; set; } = null!;
        public Report Report { get; set; } = null!;
    }
}
