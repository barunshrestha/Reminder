import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 text-sm font-normal text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
