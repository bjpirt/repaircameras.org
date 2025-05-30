import Breadcrumbs from "./Breadcrumbs";

type Props = {
  title: string;
  page: any;
  allPages: any[];
  preMain?: JSX.Element;
  children?: JSX.Children;
};

export function MainTemplate({
  children,
  title,
  page,
  allPages,
  preMain,
}: Props): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <meta
          name="description"
          content="A repository of useful manuals and resources to help you repair your camera"
        />
        <title>{title ? `Repair Cameras | ${title}` : "Repair Cameras"}</title>
        <link rel="stylesheet" href="/static/style.css" />
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
        {preMain ? preMain : undefined}
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
              <a href="https://github.com/bjpirt/repaircameras.org/">Github</a>
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
