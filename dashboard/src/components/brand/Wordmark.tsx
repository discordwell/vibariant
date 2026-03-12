interface WordmarkProps {
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Wordmark({
  className,
  leftClassName,
  rightClassName,
}: WordmarkProps) {
  return (
    <span className={className}>
      <span className={joinClasses("text-blue-400", leftClassName)}>Viba</span>
      <span className={joinClasses("text-orange-400", rightClassName)}>riant</span>
    </span>
  );
}
