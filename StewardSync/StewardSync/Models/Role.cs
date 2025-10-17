using System.ComponentModel.DataAnnotations;

namespace StewardSync.Models
{
    public class Role
    {
        public int RoleId { get; set; }

        [Required]
        [StringLength(50, MinimumLength = 2, ErrorMessage = "Role name must be between 2 and 50 characters")]
        public string RoleName { get; set; } = string.Empty;

        // Collection of users with this role
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
