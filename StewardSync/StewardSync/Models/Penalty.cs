using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Penalty
    {
        public int PenaltyId { get; set; }

        [Required]
        public int ReportId { get; set; }

        [Required]
        public PenaltyType PenaltyType { get; set; }

        public int PenaltyValue { get; set; }

        public string Reason { get; set; } = string.Empty;

        // Navigation properties
        public Report Report { get; set; } = null!;
    }
}
