// A publication is a run of issues (e.g. a journal) hosted on the Internet
// Archive. The issues themselves are IaFiles tagged with the publication id.
type Publication = {
  id: string;
  title: string;
  description: string;
  // Id of the issue whose cover represents the publication; defaults to the
  // first issue in the list when unset
  cover?: string;
  url: string;
};

export default Publication;
