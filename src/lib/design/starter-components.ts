export const STARTER_COMPONENTS = `export function Button({ variant = "primary", className = "", ...props }) {
  const look =
    variant === "primary"
      ? "bg-primary text-primary-foreground"
      : "bg-surface text-foreground border border-border";
  return <button className={\`\${look} rounded-md px-4 py-2 text-sm font-medium \${className}\`} {...props} />;
}

export function Card({ className = "", ...props }) {
  return <div className={\`bg-background border border-border rounded-lg p-4 \${className}\`} {...props} />;
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={\`bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm \${className}\`}
      {...props}
    />
  );
}

export function Badge({ className = "", ...props }) {
  return <span className={\`bg-surface text-muted rounded-full px-2 py-0.5 text-xs \${className}\`} {...props} />;
}

const HEADING_SIZES = { 1: "text-4xl font-bold", 2: "text-2xl font-semibold", 3: "text-lg font-semibold" };

export function Heading({ level = 2, className = "", ...props }) {
  const Tag = \`h\${level}\`;
  return <Tag className={\`text-foreground \${HEADING_SIZES[level]} \${className}\`} {...props} />;
}

export function Text({ className = "", ...props }) {
  return <p className={\`text-muted text-sm \${className}\`} {...props} />;
}

export function ImagePlaceholder({ label = "Image", className = "", ...props }) {
  return (
    <div className={\`bg-surface text-muted rounded-md h-48 flex items-center justify-center text-sm \${className}\`} {...props}>
      {label}
    </div>
  );
}

export function Showcase() {
  return (
    <div className="bg-background text-foreground p-8 flex flex-col gap-8">
      <Heading level={1}>Design system</Heading>
      <section className="flex flex-col gap-3">
        <Text>Buttons and badges</Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Badge>New</Badge>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <Text>Type</Text>
        <Heading level={2}>Section heading</Heading>
        <Heading level={3}>Card heading</Heading>
        <Text>Body copy in the muted colour.</Text>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <ImagePlaceholder />
          <Heading level={3}>Card</Heading>
          <Input placeholder="Email address" />
        </Card>
      </section>
    </div>
  );
}
`;
