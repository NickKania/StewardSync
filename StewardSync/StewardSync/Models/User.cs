using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class User
    {
        public int UserId { get; set; }

        [Required]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Username must be between 2 and 100 characters")]
        public string UserName { get; set; } = string.Empty;

        [Required]
        public int RoleId { get; set; }

        public int? DriverId { get; set; }

        // Navigation properties
        public Role Role { get; set; } = null!;
        public Driver? Driver { get; set; }

        // Collection of reviews made by this user
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }
}
