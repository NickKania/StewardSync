using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Event
    {
        public int EventId { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Series must be between 2 and 100 characters")]
        public string Series { get; set; } = string.Empty;

        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Event number must be positive")]
        public int EventNumber { get; set; }

        [Required]
        [StringLength(200, MinimumLength = 2, ErrorMessage = "Track name must be between 2 and 200 characters")]
        public string TrackName { get; set; } = string.Empty;

        [Required]
        [DataType(DataType.Date)]
        public DateTime EventDate { get; set; }

        // Navigation properties
        public ICollection<Report> Reports { get; set; } = new List<Report>();
        public ICollection<Race> Races { get; set; } = new List<Race>();
    }
}
