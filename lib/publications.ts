import IaFile from "./types/IaFile";
import Publication from "./types/Publication";

// An archived file that belongs to a publication, so it can be dated and
// grouped. Files without a date can't be placed in the run and are skipped.
export type PublicationIssue = IaFile & { publication: string; date: string };

export type PublicationYear = {
  year: string;
  issues: PublicationIssue[];
};

const isIssueOf = (file: IaFile, publicationId: string): boolean =>
  file.publication === publicationId && typeof file.date === "string";

// Oldest first, so a run of issues reads in the order it was published
export const issuesForPublication = (
  ia: Record<string, IaFile>,
  publicationId: string,
): PublicationIssue[] =>
  Object.values(ia)
    .filter((file) => isIssueOf(file, publicationId))
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
    .map((file) => file as PublicationIssue);

// Years keep the order of the issues they were built from
export const groupIssuesByYear = (
  issues: PublicationIssue[],
): PublicationYear[] => {
  const years: PublicationYear[] = [];

  for (const issue of issues) {
    const year = issue.date.slice(0, 4);
    const existing = years.find((y) => y.year === year);
    if (existing) {
      existing.issues.push(issue);
    } else {
      years.push({ year, issues: [issue] });
    }
  }

  return years;
};

// Issues are titled with the publication name and year ("SPT Journal 1972,
// May-June"), which is repetitive under a year heading
export const issueLabel = (issue: PublicationIssue): string =>
  issue.issue ?? issue.title;

export const coverIssue = (
  publication: Publication,
  issues: PublicationIssue[],
): PublicationIssue | undefined =>
  issues.find((issue) => issue.id === publication.cover) ?? issues[0];
