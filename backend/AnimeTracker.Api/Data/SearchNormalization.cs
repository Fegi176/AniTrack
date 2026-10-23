using System.Text;

namespace AnimeTracker.Api.Data;

public static class SearchNormalization
{
    // SQLite's upper() is ASCII-only, so aliases and queries use this same Unicode normalization.
    public static string Normalize(string value) => value.Normalize(NormalizationForm.FormKC)
        .Replace("ß", "ss").Replace("ẞ", "ss").ToUpperInvariant().Normalize(NormalizationForm.FormKC);
}
