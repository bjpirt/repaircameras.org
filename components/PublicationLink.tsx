import IaFile from "../lib/types/IaFile";
import Publication from "../lib/types/Publication";
import { coverIssue, issuesForPublication } from "../lib/publications";
import { ResourceLink } from "./ResourceLink";

type Props = {
  publication: Publication;
  ia: Record<string, IaFile>;
};

// A publication is represented by the cover of one of its issues
export function PublicationLink({ publication, ia }: Props) {
  const cover = coverIssue(
    publication,
    issuesForPublication(ia, publication.id),
  );
  if (!cover) {
    return undefined;
  }

  return (
    <ResourceLink
      id={publication.id}
      url={publication.url}
      file={{
        title: publication.title,
        description: publication.description,
        thumbnail: cover.thumbnail,
      }}
      newTab={false}
    />
  );
}
