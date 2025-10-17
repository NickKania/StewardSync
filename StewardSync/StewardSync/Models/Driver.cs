using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Driver
    {
        public int DriverId { get; set; }

        [Required]
        [Range(1, 999, ErrorMessage = "Driver number must be between 1 and 999")]
        public int DriverNumber { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Driver name must be between 2 and 100 characters")]
        public string DriverName { get; set; } = string.Empty;

        [Required]
        [StringLength(50, ErrorMessage = "External ID cannot exceed 50 characters")]
        public string ExternalId { get; set; } = string.Empty;

        [StringLength(50, ErrorMessage = "Driver class cannot exceed 50 characters")]
        public string? DriverClass { get; set; }

        // Navigation properties for reports
        public ICollection<Report> ReportedIncidents { get; set; } = new List<Report>();
        public ICollection<Report> FiledReports { get; set; } = new List<Report>();
    }
}
