import { describe, it, expect } from "vitest";
import IaFile from "./types/IaFile";
import Publication from "./types/Publication";
import {
  coverIssue,
  groupIssuesByYear,
  issueLabel,
  issuesForPublication,
  PublicationIssue,
} from "./publications";

const iaFile = (overrides: Partial<IaFile> & { id: string }): IaFile => ({
  identifier: `repaircameras-${overrides.id}`,
  file: `${overrides.id}.pdf`,
  title: overrides.id,
  url: `/files/${overrides.id}/`,
  detailsUrl: "",
  downloadUrl: "",
  embedUrl: "",
  thumbnail: { webp: [], jpeg: [] },
  ...overrides,
});

const ia = (...files: IaFile[]): Record<string, IaFile> =>
  Object.fromEntries(files.map((file) => [file.id, file]));

const publication: Publication = {
  id: "spt-journal",
  title: "SPT Journal",
  description: "",
  url: "/publications/spt-journal/",
};

describe("issuesForPublication", () => {
  it("returns only the issues of that publication", () => {
    const files = ia(
      iaFile({ id: "a", publication: "spt-journal", date: "1972-05" }),
      iaFile({ id: "b", publication: "other-journal", date: "1972-05" }),
      iaFile({ id: "c" }),
    );

    expect(issuesForPublication(files, "spt-journal").map((i) => i.id)).toEqual(
      ["a"],
    );
  });

  it("skips issues with no date, which can't be placed in the run", () => {
    const files = ia(
      iaFile({ id: "undated", publication: "spt-journal" }),
      iaFile({ id: "dated", publication: "spt-journal", date: "1980-07" }),
    );

    expect(issuesForPublication(files, "spt-journal").map((i) => i.id)).toEqual(
      ["dated"],
    );
  });

  it("sorts issues oldest first", () => {
    const files = ia(
      iaFile({ id: "middle", publication: "spt-journal", date: "1980-07" }),
      iaFile({ id: "oldest", publication: "spt-journal", date: "1972-05" }),
      iaFile({ id: "newest", publication: "spt-journal", date: "1984-11" }),
    );

    expect(issuesForPublication(files, "spt-journal").map((i) => i.id)).toEqual(
      ["oldest", "middle", "newest"],
    );
  });

  it("returns an empty list for an unknown publication", () => {
    expect(issuesForPublication(ia(), "spt-journal")).toEqual([]);
  });
});

describe("groupIssuesByYear", () => {
  const issue = (id: string, date: string): PublicationIssue =>
    iaFile({ id, publication: "spt-journal", date }) as PublicationIssue;

  it("groups issues by the year of their date", () => {
    const grouped = groupIssuesByYear([
      issue("may-1972", "1972-05"),
      issue("jul-1984", "1984-07"),
      issue("nov-1984", "1984-11"),
    ]);

    expect(grouped).toEqual([
      { year: "1972", issues: [issue("may-1972", "1972-05")] },
      {
        year: "1984",
        issues: [issue("jul-1984", "1984-07"), issue("nov-1984", "1984-11")],
      },
    ]);
  });

  it("keeps the order of the issues it was given", () => {
    const grouped = groupIssuesByYear([
      issue("b", "1984-11"),
      issue("a", "1972-05"),
    ]);

    expect(grouped.map((y) => y.year)).toEqual(["1984", "1972"]);
  });

  it("returns no years for no issues", () => {
    expect(groupIssuesByYear([])).toEqual([]);
  });
});

describe("issueLabel", () => {
  it("uses the issue label when set", () => {
    const issue = iaFile({
      id: "a",
      title: "SPT Journal 1972, May-June",
      publication: "spt-journal",
      date: "1972-05",
      issue: "May-June",
    }) as PublicationIssue;

    expect(issueLabel(issue)).toEqual("May-June");
  });

  it("falls back to the title", () => {
    const issue = iaFile({
      id: "a",
      title: "SPT Journal 1972, May-June",
      publication: "spt-journal",
      date: "1972-05",
    }) as PublicationIssue;

    expect(issueLabel(issue)).toEqual("SPT Journal 1972, May-June");
  });
});

describe("coverIssue", () => {
  const issues = [
    iaFile({ id: "newest", publication: "spt-journal", date: "1984-11" }),
    iaFile({ id: "oldest", publication: "spt-journal", date: "1972-05" }),
  ] as PublicationIssue[];

  it("uses the nominated cover issue", () => {
    expect(coverIssue({ ...publication, cover: "oldest" }, issues)?.id).toEqual(
      "oldest",
    );
  });

  it("falls back to the first issue when the cover is unknown", () => {
    expect(
      coverIssue({ ...publication, cover: "missing" }, issues)?.id,
    ).toEqual("newest");
  });

  it("falls back to the first issue when no cover is set", () => {
    expect(coverIssue(publication, issues)?.id).toEqual("newest");
  });

  it("returns nothing when there are no issues", () => {
    expect(coverIssue(publication, [])).toBeUndefined();
  });
});
