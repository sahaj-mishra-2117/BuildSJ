(() => {
  async function read(session) {
    const selectors = [["id", session.user.id], ["email", session.user.email]]
      .filter(([, value]) => value);

    for (const [column, value] of selectors) {
      let query = supabaseClient.from("profiles").select("address");
      query = column === "id" ? query.eq(column, value) : query.ilike(column, value);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      if (data) return data.address || "";
    }

    return "";
  }

  async function save(session, address) {
    const selectors = [["id", session.user.id], ["email", session.user.email]]
      .filter(([, value]) => value);
    let updateError = null;

    for (const [column, value] of selectors) {
      let query = supabaseClient.from("profiles").update({ address });
      query = column === "id" ? query.eq(column, value) : query.ilike(column, value);
      const { data, error } = await query.select("id").limit(1);
      if (error) {
        updateError = updateError || error;
        continue;
      }
      if (data && data.length > 0) return;
    }

    if (updateError) throw updateError;

    const { error } = await supabaseClient.from("profiles").insert({
      id: session.user.id,
      email: session.user.email,
      checked_in: false,
      progress_percentage: 0,
      tasks_completed: 0,
      address,
    });
    if (error) throw error;
  }

  window.profileAddress = { read, save };
})();
