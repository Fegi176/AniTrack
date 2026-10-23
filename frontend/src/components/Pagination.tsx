import { ChevronLeft, ChevronRight } from "lucide-react";
import { number } from "../format";

export function Pagination({
  page,
  totalPages,
  changePage,
  label = "Catalog pages",
}: {
  page: number;
  totalPages: number;
  changePage: (page: number) => void;
  label?: string;
}) {
  const pages = [
    ...new Set([
      1,
      totalPages,
      page - 1,
      page,
      page + 1,
      ...(page <= 3 ? [2, 3, 4] : []),
      ...(page >= totalPages - 2
        ? [totalPages - 3, totalPages - 2, totalPages - 1]
        : []),
    ]),
  ]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const compact = [...new Set([1, page, totalPages])].sort((a, b) => a - b);
  const steps = (values: number[]) =>
    values.map((value, index) => (
      <span key={value} className="page-step">
        {index > 0 && value - values[index - 1] > 1 && (
          <span className="page-ellipsis" aria-hidden="true">
            …
          </span>
        )}
        <button
          className={`page-number ${value === page ? "selected" : ""}`}
          aria-label={`Page ${number(value)}`}
          aria-current={value === page ? "page" : undefined}
          onClick={() => changePage(value)}
        >
          {number(value)}
        </button>
      </span>
    ));
  return (
    <nav className="pagination" aria-label={label}>
      <button
        className="button secondary page-direction"
        aria-label="Previous"
        disabled={page <= 1}
        onClick={() => changePage(page - 1)}
      >
        <ChevronLeft size={17} />
        <span>Previous</span>
      </button>
      <div className="page-numbers full-pages">{steps(pages)}</div>
      <div className="page-numbers compact-pages">{steps(compact)}</div>
      <button
        className="button secondary page-direction"
        aria-label="Next"
        disabled={page >= totalPages}
        onClick={() => changePage(page + 1)}
      >
        <span>Next</span>
        <ChevronRight size={17} />
      </button>
      <p className="page-summary" role="status">
        Page {number(page)} of {number(totalPages)}
      </p>
    </nav>
  );
}
