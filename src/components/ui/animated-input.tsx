import * as React from "react"
import { cn } from "@/lib/utils"

export interface AnimatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  placeholders: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

const AnimatedInput = React.forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({
    className,
    type,
    placeholders,
    typingSpeed = 100,
    deletingSpeed = 50,
    pauseDuration = 1500,
    value,
    ...props
  }, ref) => {
    const [placeholder, setPlaceholder] = React.useState("");
    const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
    const [isTyping, setIsTyping] = React.useState(true);

    // Only animate when input is empty
    const hasValue = value !== undefined && value !== "" && value !== 0;

    React.useEffect(() => {
      if (hasValue || placeholders.length === 0) {
        setPlaceholder(placeholders[0] || "");
        return;
      }

      const currentText = placeholders[placeholderIndex];
      let timeout: NodeJS.Timeout;

      if (isTyping) {
        if (placeholder.length < currentText.length) {
          // Still typing
          timeout = setTimeout(() => {
            setPlaceholder(currentText.slice(0, placeholder.length + 1));
          }, typingSpeed);
        } else {
          // Finished typing, pause then start deleting
          timeout = setTimeout(() => {
            setIsTyping(false);
          }, pauseDuration);
        }
      } else {
        if (placeholder.length > 0) {
          // Still deleting
          timeout = setTimeout(() => {
            setPlaceholder(placeholder.slice(0, -1));
          }, deletingSpeed);
        } else {
          // Finished deleting, move to next placeholder
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
          setIsTyping(true);
        }
      }

      return () => clearTimeout(timeout);
    }, [placeholder, placeholderIndex, isTyping, placeholders, hasValue, typingSpeed, deletingSpeed, pauseDuration]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        placeholder={placeholder}
        value={value}
        ref={ref}
        {...props}
      />
    )
  }
)
AnimatedInput.displayName = "AnimatedInput"

export { AnimatedInput }
