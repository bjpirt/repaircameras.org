import Breadcrumbs from "./Breadcrumbs";

type Props = {
  title: string;
  page: any;
  allPages: any[];
  children?: JSX.Children;
};

export function MainTemplate({
  children,
  title,
  page,
  allPages,
}: Props): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>{title ? `Repair Cameras | ${title}` : "Repair Cameras"}</title>
        <link rel="stylesheet" href="/css/style.css" />
      </head>
      <body>
        <header>
          <a href="/">
            <h1>🛠️ 📷 Repair Cameras</h1>
          </a>
        </header>
        <div id="breadcrumbs">
          {page.url !== "/" ? (
            <Breadcrumbs page={page} allPages={allPages} />
          ) : undefined}
        </div>
        <main>{children}</main>
        <footer>
          <ul>
            <li>
              <a href="/about/">About</a>
            </li>
            <li>
              <a href="/contributing/">Contributing</a>
            </li>
            <li>
              <a href="/">Github</a>
            </li>
            <li>
              <a href="/open-source/">Open Source</a>
            </li>
          </ul>
        </footer>
      </body>
    </html>
  );
}
