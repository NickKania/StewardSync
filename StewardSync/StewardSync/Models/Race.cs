using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Race
    {
        public int RaceId { get; set; }

        [Required]
        public int EventId { get; set; }

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Race number must be positive")]
        public int RaceNumber { get; set; }

        // Navigation properties
        public Event Event { get; set; } = null!;
        public ICollection<Report> Reports { get; set; } = new List<Report>();
    }
}
