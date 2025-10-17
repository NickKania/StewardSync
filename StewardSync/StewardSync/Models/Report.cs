using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Report
    {
        public int ReportId { get; set; }

        [DataType(DataType.DateTime)]
        public DateTime ReportDate { get; set; } = DateTime.UtcNow;

        [Required]
        public int ReportingDriverId { get; set; }

        [Required]
        public int ReportedDriverId { get; set; }

        [Required]
        public int EventId { get; set; }

        [Required]
        public int RaceId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Turn number must be positive")]
        public int Turn { get; set; }

        [Required]
        [StringLength(2000, MinimumLength = 10, ErrorMessage = "Description must be between 10 and 2000 characters")]
        public string Description { get; set; } = string.Empty;

        public bool IsFinalized { get; set; } = false;

        // Navigation properties
        public Driver ReportingDriver { get; set; } = null!;
        public Driver ReportedDriver { get; set; } = null!;
        public Event Event { get; set; } = null!;
        public Race Race { get; set; } = null!;

        // Collection of reviews for this report
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }
}
