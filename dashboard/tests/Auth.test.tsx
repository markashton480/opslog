import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrincipalAvatar } from "@/components/PrincipalAvatar";

describe("Auth token display helpers", () => {
  it("renders principal identifier", () => {
    render(<PrincipalAvatar principal="readonly" />);
    expect(screen.getByText("readonly")).toBeInTheDocument();
  });
});
